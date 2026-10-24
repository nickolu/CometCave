import { inCup } from '@/app/meteor-coins/lib/board'
import {
  DROP_Z,
  type Deck,
  GRAVITY,
  PHYSICS_STEP_S,
  PUCK_THICKNESS,
  PUSHER_HEIGHT,
  deckUnder,
} from '@/app/meteor-coins/lib/cabinet'
import {
  type CannonConfig,
  type Vec,
  cannonYaw,
  chargeAfter,
  flightPath,
  launchVelocity,
  muzzleAt,
  throughHoop,
} from '@/app/meteor-coins/lib/cannon'
import { RING_Y, armTip, dropLines, isHit } from '@/app/meteor-coins/lib/dropper'
import {
  type EngineOptions,
  type Obstacle,
  PusherEngine,
  obstacleZ,
} from '@/app/meteor-coins/lib/engine'
import { moonAt, moonPull } from '@/app/meteor-coins/lib/moon'
import type { ObjectSpec } from '@/app/meteor-coins/lib/objects'
import { PILES } from '@/app/meteor-coins/lib/piles'
import {
  type GameState,
  beatDrop,
  canDrop,
  drop,
  fall,
  hoopHit,
  initialState,
  pourBonus,
  resolveShot,
  setTowers,
  shotLanded,
  tempoIdle,
  tick,
} from '@/app/meteor-coins/lib/rules'
import {
  type CoinState,
  type TowerPost,
  landsOnPost,
  measureTower,
} from '@/app/meteor-coins/lib/stacks'
import type { StageDef } from '@/app/meteor-coins/lib/stages'
import { fallTime, fallTimeToShelf, shelfOpenAt } from '@/app/meteor-coins/lib/timing'

/**
 * A shot that hasn't passed the ring by now is a miss — it landed on a pile
 * taller than the ring. Without this, that shot would never resolve and the
 * game could never end (a 3-layer sim ran 200s instead of ~70s). A clean drop
 * reaches the ring in well under half a second.
 */
const SHOT_TIMEOUT_S = 1.5

/** One bonus coin every this many physics steps — 25 coins pour out in 2.5s. */
const SHOWER_INTERVAL_STEPS = 6

/** Towers are re-measured this often (every 0.1s), not every step. */
const TOWER_INTERVAL_STEPS = 6

/** A coin never spawns closer than this above a tower's top, even if the arm is lower. */
const SPAWN_CLEARANCE = 0.25

export type TowerPostDef = Extract<Obstacle, { type: 'post' }> & { tower: string }

/**
 * Where a drop released now would land: on a tower (its index, and how far
 * off its center), or not.
 */
export type Landing = { x: number; y: number; z: number; post: number | null; offset: number }

/** A fired coin is done once it's below the hoops and falling, or after this long. */
const CANNON_SHOT_TIMEOUT_S = 3
/** Where hoop bonuses pour: across the back of the shelf, from the backboard. */
const BONUS_POUR = { y: 2.5, z: DROP_Z, halfWidth: 2.6 }
/** A coin on a pachinko board moving slower than this has come to rest, and gets nudged by this. */
const STILL_SPEED = 0.05
const NUDGE = 0.6
/** How far below a pachinko board its skirt hangs, hiding coins being laid flat. */
const SKIRT = 0.7

/** A dropped coin's preview ends here, around the top of the pile. */
const PREVIEW_FLOOR_Y = 1
/** A meteorite counts as still falling (the stage can't end) for this long after it drops in. */
const METEOR_FALL_S = 2

/** A meteorite announced on the table: where it'll land, and seconds until it drops. */
export type MeteorWarning = { x: number; z: number; secondsLeft: number }

/** A fired coin flies flat, so half its thickness is what has to clear a hoop's rim above and below. */
const FLAT_COIN_HALF_HEIGHT = PUCK_THICKNESS / 2

export type GameEvent =
  | { type: 'shot'; hit: boolean; bonus: number; streak: number }
  | { type: 'hoop'; bonus: number }
  /** A coin was caught in a pachinko cup: it pours `bonus`. */
  | { type: 'cup'; bonus: number }
  /** A meteorite has been announced: it drops in after its countdown. */
  | { type: 'meteor' }
  /** A new phase has started (its index). */
  | { type: 'phase'; index: number }
  /** The Last Push has started. */
  | { type: 'lastPush' }
  | { type: 'fall'; result: 'chute' | 'gutter'; object: ObjectSpec }

/**
 * One stage in play: the engine, the swinging arm and the rules, stepped
 * together and configured by the stage. Runs identically on screen and
 * headless; the renderer only reads from it.
 */
export class DropGame {
  readonly stage: StageDef
  readonly engine: PusherEngine
  state: GameState
  /** Arm and ring clock. Advances with physics time × speed. */
  dropperTime = 0
  speed = 1
  /** The drop line the next coin goes to, where the stage's arms take turns. */
  line = 0

  /** Player coins that haven't reached the ring's height yet, and the tempo each was dropped at. */
  private inFlight: { index: number; droppedAt: number; tempo: number }[] = []
  /** Arm time of the first drop: a timed stage's clock starts there. */
  private clockFrom: number | null = null
  /** Whether the slower arm was on at any point of a timed run. */
  slowed = false
  /** Coins fired from the cannon still in the air, and where each was last step. */
  private fired: { index: number; firedAt: number; last: Vec; hoops: Set<number> }[] = []
  /** How the cannon is fired: hold and let go, or tap twice. */
  cannonMode: 'hold' | 'tap' = 'hold'
  /** While charging: the aim locked by the press, and when it was pressed. */
  private charging: { yaw: number; from: number } | null = null
  /** The last shot's charge: the arc shown while aiming. A first shot previews full. */
  private lastPower = 1
  private showerCooldown = 0
  /** Coins dropped so far: meteorites and phases are timed by it. */
  private drops = 0
  /** The phase the cabinet is in, on a stage with phases. */
  phase = 0
  /** Events raised between steps (by a tap), handed out with the next step's. */
  private pending: GameEvent[] = []
  /** The stage's meteorites: parked until their drop, then announced, then dropped in. */
  private meteors: {
    index: number
    afterDrop: number
    x: number
    z: number
    /** Arm time it drops in at, once announced. */
    at: number | null
    /** Physics time it dropped in at. */
    placedAt: number | null
    /** Whether its announcement has gone out as an event. */
    called: boolean
  }[] = []
  /** The posts a stack goal counts, in the goal's order. */
  readonly towerPosts: TowerPostDef[]

  /** Call initPhysics() first. `options` overrides the stage's engine setup, for tests. */
  constructor(stage: StageDef, options: EngineOptions = {}) {
    this.stage = stage
    this.state = initialState(stage.rules)
    this.towerPosts = (stage.table.obstacles ?? []).filter(
      (o): o is TowerPostDef => o.type === 'post' && o.tower !== undefined
    )
    this.engine = new PusherEngine({
      poolObject: stage.objects.drop,
      pile: stage.pile ? PILES[stage.pile] : [],
      chuteHalfWidth: stage.table.chuteHalfWidth,
      pusherPeriodS: stage.table.pusherPeriodS,
      obstacles: stage.table.obstacles,
      floorFriction: stage.table.floorFriction,
      floorDrift: stage.table.floorDrift,
      layout: stage.table.layout,
      board: stage.table.board,
      ...options,
    })
    const shower = stage.meteors
    if (shower) {
      this.meteors = shower.schedule.map(m => ({
        ...m,
        index: this.engine.addParked(shower.object),
        at: null,
        placedAt: null,
        called: false,
      }))
    }
  }

  /** Whether the ring is out: the stage has one, and the phase uses it. */
  get ringOn(): boolean {
    return this.stage.ring.enabled && (this.stage.phases?.[this.phase]?.ring ?? true)
  }

  /** Gravity now, as a share of the usual. */
  get gravityScale(): number {
    return this.stage.phases?.[this.phase]?.gravityScale ?? 1
  }

  /** Moves to the phase the drops so far have reached, reconfiguring the cabinet. */
  private advancePhase() {
    const phases = this.stage.phases
    if (!phases) return
    let spent = 0
    let next = phases.length - 1
    for (let i = 0; i < phases.length; i++) {
      spent += phases[i].coins
      if (this.drops < spent) {
        next = i
        break
      }
    }
    if (next === this.phase) return
    this.phase = next
    this.engine.setPhase(next)
    this.engine.setGravityScale(this.gravityScale)
    this.pending.push({ type: 'phase', index: next })
  }

  /** Where the moon is now, on a stage that has one. */
  get moon(): Vec | null {
    return this.stage.moon ? moonAt(this.dropperTime, this.stage.moon) : null
  }

  /**
   * The path something falling from `start` would take, released at arm
   * time `t0`, bent by the moon if there is one. Exact, until it meets
   * the pile.
   */
  private fallPath(
    start: Vec,
    t0: number,
    stop: (p: Vec) => boolean = p => p.y < PREVIEW_FLOOR_Y
  ): Vec[] {
    const m = this.stage.moon
    const dt = PHYSICS_STEP_S * this.speed
    const pull = m ? (p: Vec, k: number) => moonPull(p, moonAt(t0 + (k + 1) * dt, m), m) : undefined
    return flightPath(start, { x: 0, y: -1, z: 0 }, stop, 240, pull, GRAVITY * this.gravityScale)
  }

  /** The path a coin released `ahead` seconds from now would fall. */
  dropPath(ahead = 0): Vec[] {
    return this.fallPath(this.armTip(ahead), this.dropperTime + ahead * this.speed)
  }

  /** Meteorites announced and about to drop in: where each will land, and when. */
  meteorWarnings(): MeteorWarning[] {
    const shower = this.stage.meteors
    if (!shower) return []
    return this.meteors
      .filter(m => m.at !== null && m.placedAt === null)
      .map(m => {
        const at = m.at as number
        // It drops in on the first step at or after `at`, and feels the moon from that step.
        const path = this.fallPath(
          { x: m.x, y: shower.y, z: m.z },
          at - PHYSICS_STEP_S * this.speed
        )
        const end = path[path.length - 1]
        return { x: end.x, z: end.z, secondsLeft: (at - this.dropperTime) / this.speed }
      })
  }

  /** Where a puck released `ahead` seconds from now would start. */
  armTip(ahead = 0) {
    return armTip(this.dropperTime + ahead * this.speed, this.stage.arm, this.line)
  }

  /** The deck the next coin lands on. */
  get dropDeck(): Deck {
    return deckUnder(this.engine.layout, this.armTip().z)
  }

  get canDrop() {
    return canDrop(this.state) && this.engine.freeCount > 0 && !this.boardBusy
  }

  /**
   * Whether a dropped coin is still on its way down a pachinko board. One at
   * a time, as with a pachinko ball: coins dropped into the slot back to
   * back locked into arches and jammed it.
   */
  get boardBusy(): boolean {
    const board = this.stage.table.board
    if (!board) return false
    // Coins waiting in the bins for the gate don't count: they're down.
    const pinsFrom = board.gated ? board.dividerTop : board.bottomY
    return this.engine.pucks.some(p => {
      if (!p.active || p.kind !== 'player') return false
      const t = p.body.translation()
      return t.y > pinsFrom && Math.abs(t.z - board.z) < board.slot
    })
  }

  /** Whether a coin released now would land on bare shelf (see lib/timing). */
  get dropLandsClear() {
    const deck = this.dropDeck
    // Under the moon a coin falls a curve, and in low gravity it falls
    // slower; either way it takes its own time to land.
    const fallS =
      this.stage.moon || this.gravityScale !== 1
        ? this.dropLanding().fallS
        : fallTimeToShelf(this.armTip().y, deck.floorY)
    return shelfOpenAt(this.engine.time + fallS, this.engine.pusherPeriodS, deck.pusher.lagS)
  }

  /**
   * Where a coin released `ahead` seconds from now reaches the top of the
   * pusher, and how long it falls to get there (from its release).
   */
  dropLanding(ahead = 0): { x: number; z: number; fallS: number } {
    const shelfY = this.dropDeck.floorY + PUSHER_HEIGHT + PUCK_THICKNESS / 2
    const path = this.fallPath(
      this.armTip(ahead),
      this.dropperTime + ahead * this.speed,
      p => p.y < shelfY
    )
    const end = path[path.length - 1]
    return { x: end.x, z: end.z, fallS: (path.length - 1) * PHYSICS_STEP_S }
  }

  /** Whether the stage's cue is lit: a drop now would land where it should. */
  get cueLit() {
    return this.stage.cue === 'dot' ? this.landing().post !== null : this.dropLandsClear
  }

  /** A tower post as it stands at `timeS`. */
  private postAt(post: TowerPostDef, timeS: number): TowerPost {
    return { ...post, z: obstacleZ(post, timeS, this.engine.pusherPeriodS) }
  }

  /** The top of a post's tower now. Towers on this table are coins. */
  towerTop(i: number): number {
    return this.towerPosts[i].height + this.state.towers[i] * PUCK_THICKNESS
  }

  /**
   * Where a coin released `ahead` seconds from now would land, judged against
   * where each post will be when it gets there (the middle one moves).
   */
  landing(ahead = 0): Landing {
    const tip = this.armTip(ahead)
    const releaseAt = this.engine.time + ahead
    for (let i = 0; i < this.towerPosts.length; i++) {
      const top = this.towerTop(i)
      const fall = fallTime(tip.y - top)
      const post = this.postAt(this.towerPosts[i], releaseAt + fall)
      if (landsOnPost(post, tip.x, tip.z)) {
        const offset = Math.hypot(tip.x - post.x, tip.z - post.z)
        return { x: tip.x, y: top, z: tip.z, post: i, offset }
      }
    }
    return { x: tip.x, y: 0, z: tip.z, post: null, offset: Infinity }
  }

  /** Seconds on the stage's clock: arm time since the first drop. */
  get clockS(): number {
    return this.clockFrom === null ? 0 : this.dropperTime - this.clockFrom
  }

  /** Seconds left on a timed stage, or null when it has no clock. */
  get timeLeftS(): number | null {
    const limit = this.stage.rules.timeLimitS
    return limit === undefined ? null : Math.max(0, limit - this.clockS)
  }

  get cannon(): CannonConfig | undefined {
    return this.stage.cannon
  }

  /** Where the cannon points: locked while charging, swinging otherwise. */
  get cannonYaw(): number {
    const c = this.cannon
    if (!c) return 0
    return this.charging ? this.charging.yaw : cannonYaw(this.dropperTime, c)
  }

  /** The charge so far, 0 to 1, or null when not charging. */
  get charge(): number | null {
    const c = this.cannon
    if (!c || !this.charging) return null
    return chargeAfter(this.dropperTime - this.charging.from, c)
  }

  /** The arc a shot would fly: at the current charge, or the last shot's while aiming. */
  previewPath(): Vec[] {
    const c = this.cannon
    if (!c) return []
    const yaw = this.cannonYaw
    const v = launchVelocity(yaw, this.charge ?? this.lastPower, c)
    return flightPath(muzzleAt(yaw, c), v, p => p.y < 0.7 || p.z < DROP_Z - 0.4)
  }

  /**
   * Press (pointer down, Space down). Drops a coin from the arm; on a cannon
   * stage, locks the aim and starts the charge, or in tap mode fires a
   * charge already started.
   */
  press(): boolean {
    if (!this.cannon) return this.tapDrop()
    if (!this.canDrop) return false
    if (!this.charging) {
      this.charging = { yaw: this.cannonYaw, from: this.dropperTime }
      return true
    }
    return this.cannonMode === 'tap' ? this.fire() : false
  }

  /** Release (pointer up, Space up): fires, when holding is how the cannon fires. */
  release(): boolean {
    return this.cannonMode === 'hold' && this.charging !== null && this.fire()
  }

  private fire(): boolean {
    const c = this.cannon
    if (!c || !this.charging || !this.canDrop) return false
    const power = this.charge ?? 0
    const { yaw } = this.charging
    const start = muzzleAt(yaw, c)
    const v = launchVelocity(yaw, power, c)
    const index = this.engine.spawn(start.x, start.y, start.z, 'player', 0, v)
    if (index === null) return false
    this.charging = null
    this.lastPower = power
    this.state = drop(this.state)
    this.fired.push({ index, firedAt: this.engine.time, last: start, hoops: new Set() })
    return true
  }

  /** The player's tap. Returns false if there was nothing to drop. */
  tapDrop(): boolean {
    if (!this.canDrop) return false
    const tip = this.armTip()
    // A tower that has grown up to the arm: release just above it instead.
    const { post } = this.landing()
    if (post !== null) tip.y = Math.max(tip.y, this.towerTop(post) + SPAWN_CLEARANCE)
    // Judged before the coin exists, as the cue showed it.
    const onBeat = this.dropLandsClear
    const index = this.engine.spawn(tip.x, tip.y, tip.z, 'player', 0, undefined, this.upright)
    if (index === null) return false
    this.clockFrom ??= this.dropperTime
    this.drops++
    this.advancePhase()
    for (const m of this.meteors) {
      if (m.afterDrop === this.drops) m.at = this.dropperTime + (this.stage.meteors?.warnS ?? 0)
    }
    this.state = drop(this.state)
    this.state = beatDrop(this.state, onBeat, this.dropperTime, this.stage.rules)
    this.line = (this.line + 1) % dropLines(this.stage.arm).length
    if (this.ringOn) {
      this.inFlight.push({ index, droppedAt: this.engine.time, tempo: this.state.tempo })
    }
    return true
  }

  step(): GameEvent[] {
    const events: GameEvent[] = this.pending
    this.pending = []
    this.dropperTime += PHYSICS_STEP_S * this.speed
    this.dropMeteors()
    this.pullTowardMoon()
    this.pullHome()
    for (const m of this.meteors) {
      if (m.at === null || m.called) continue
      m.called = true
      events.push({ type: 'meteor' })
    }

    for (const f of this.engine.step()) {
      this.state = fall(this.state, f.result, this.engine.time, f.spec, this.stage.rules)
      events.push({ type: 'fall', result: f.result, object: f.spec })
      const push = this.stage.lastPush
      if (push && f.result === 'chute' && f.spec.id === push.object) {
        this.engine.lastPush(push.seconds)
        events.push({ type: 'lastPush' })
      }
    }

    // A shot resolves on the step the coin's center passes the ring's height.
    this.inFlight = this.inFlight.filter(shot => {
      const puck = this.engine.pucks[shot.index]
      const y = puck.active ? puck.body.translation().y : -Infinity
      const timedOut = this.engine.time - shot.droppedAt > SHOT_TIMEOUT_S
      if (y > RING_Y && !timedOut) return true
      const hit =
        !timedOut &&
        puck.active &&
        isHit(puck.body.translation().x, this.dropperTime, puck.spec.reach, this.stage.ring)
      const before = this.state.showerLeft
      this.state = resolveShot(this.state, hit, this.stage.rules, shot.tempo)
      events.push({
        type: 'shot',
        hit,
        streak: this.state.streak,
        bonus: this.state.showerLeft - before,
      })
      return false
    })

    this.trackFired(events)
    this.catchInCups(events)

    if (this.state.showerLeft > 0 && --this.showerCooldown <= 0) {
      const tip = this.cannon || this.upright ? this.bonusPour() : this.armTip()
      // A full pool waits rather than dropping the bonus; falls free slots up.
      if (this.engine.spawn(tip.x, tip.y, tip.z, 'bonus', this.engine.time * 3) !== null) {
        this.state = pourBonus(this.state)
        this.showerCooldown = SHOWER_INTERVAL_STEPS
      }
    }

    if (this.towerPosts.length && ++this.towerClock % TOWER_INTERVAL_STEPS === 0) {
      this.state = setTowers(this.state, this.measureTowers())
    }

    if (this.canDrop) this.state = tempoIdle(this.state, this.dropperTime, this.stage.rules)
    if (this.speed < 1 && this.state.phase === 'playing') this.slowed = true

    const meteorsDue = this.meteors.filter(
      m =>
        (m.at !== null && m.placedAt === null) ||
        (m.placedAt !== null && this.engine.time - m.placedAt < METEOR_FALL_S)
    ).length
    const flying =
      this.inFlight.length +
      this.fired.length +
      (this.charging ? 1 : 0) +
      meteorsDue +
      (this.engine.pushing ? 1 : 0) +
      (this.boardBusy ? 1 : 0)
    this.state = tick(this.state, this.engine.time, flying, this.stage.rules, this.clockS)
    return events
  }

  /** Drops in each announced meteorite whose countdown has run out. */
  private dropMeteors() {
    const shower = this.stage.meteors
    if (!shower) return
    for (const m of this.meteors) {
      if (m.at === null || m.placedAt !== null || this.dropperTime < m.at) continue
      this.engine.place(m.index, m.x, shower.y, m.z)
      m.placedAt = this.engine.time
    }
  }

  /**
   * The moon pulls on everything in the air, as a change of velocity just
   * before the physics steps — the same rule fallPath predicts with.
   */
  private pullTowardMoon() {
    const m = this.stage.moon
    if (!m) return
    const moon = moonAt(this.dropperTime, m)
    for (const puck of this.engine.pucks) {
      if (!puck.active) continue
      const p = puck.body.translation()
      if (p.y < m.minY) continue
      const a = moonPull(p, moon, m)
      const v = puck.body.linvel()
      const dt = PHYSICS_STEP_S
      puck.body.setLinvel({ x: v.x + a.x * dt, y: v.y + a.y * dt, z: v.z + a.z * dt }, true)
    }
  }

  /** Coins drop on edge where they fall through a pachinko board. */
  private get upright(): boolean {
    return this.stage.table.board !== undefined
  }

  /**
   * Takes coins that have landed in a pachinko cup off the board, and pours
   * each cup's bonus. A coin that has come to rest anywhere else on the
   * board (dead center on a pin, say) gets a nudge sideways: a pachinko
   * ball never balances, and one coin stuck would hold up every drop.
   */
  private catchInCups(events: GameEvent[]) {
    const board = this.stage.table.board
    if (!board) return
    this.engine.pucks.forEach((puck, index) => {
      if (!puck.active) return
      const p = puck.body.translation()
      if (Math.abs(p.z - board.z) > board.slot) return
      if (p.y < board.bottomY) {
        // Just out of the board (behind its skirt): laid flat, so it lands
        // like any other drop. On edge, coins wedged upright in the pile by
        // the back wall and the shelf stopped paying (5 points against 24).
        const r = puck.body.rotation()
        const upY = 1 - 2 * (r.x * r.x + r.z * r.z)
        if (p.y > board.bottomY - SKIRT && Math.abs(upY) < 0.9) {
          const half = (index * 2.4) / 2
          puck.body.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true)
          puck.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }
        return
      }
      const v = puck.body.linvel()
      if (Math.hypot(v.x, v.y) < STILL_SPEED) {
        // Toward the middle, away from the ends where it could only push into a wall.
        puck.body.setLinvel({ x: v.x + (p.x > 0 ? -NUDGE : NUDGE), y: v.y, z: v.z }, true)
      }
      const cup = board.cups.find(c => inCup(c, p.x, p.y))
      if (!cup) return
      this.engine.remove(index)
      this.state = hoopHit(this.state, cup.bonus)
      events.push({ type: 'cup', bonus: cup.bonus })
    })
  }

  /** In a phase with homing, eases the last-push object toward the chute. */
  private pullHome() {
    const homing = this.stage.phases?.[this.phase]?.homing
    const id = this.stage.lastPush?.object
    if (!homing || !id) return
    for (const puck of this.engine.pucks) {
      if (!puck.active || puck.spec.id !== id) continue
      const v = puck.body.linvel()
      puck.body.setLinvel({ x: v.x, y: v.y, z: v.z + homing * PHYSICS_STEP_S }, true)
    }
  }

  /** Checks fired coins against the hoops, and settles the ones that have come down. */
  private trackFired(events: GameEvent[]) {
    const hoops = this.cannon?.hoops ?? []
    const lowest = Math.min(...hoops.map(h => h.y - h.radius))
    this.fired = this.fired.filter(shot => {
      const puck = this.engine.pucks[shot.index]
      if (!puck.active) {
        this.state = shotLanded(this.state)
        return false
      }
      const t = puck.body.translation()
      const now = { x: t.x, y: t.y, z: t.z }
      hoops.forEach((hoop, i) => {
        if (shot.hoops.has(i)) return
        if (!throughHoop(hoop, shot.last, now, puck.spec.reach, FLAT_COIN_HALF_HEIGHT)) return
        shot.hoops.add(i)
        this.state = hoopHit(this.state, hoop.bonus)
        events.push({ type: 'hoop', bonus: hoop.bonus })
      })
      shot.last = now
      const down = now.y < lowest && puck.body.linvel().y <= 0
      if (down || this.engine.time - shot.firedAt > CANNON_SHOT_TIMEOUT_S) {
        this.state = shotLanded(this.state)
        return false
      }
      return true
    })
  }

  private pours = 0

  /** Where the next hoop bonus coin pours from: stepping across the back of the shelf. */
  private bonusPour(): Vec {
    const x = BONUS_POUR.halfWidth * Math.sin(this.pours++ * 2.4)
    // Under a pachinko board, straight onto the drop strip below it, skipping
    // the pins. (Poured in front of the glass, they landed mid-pile and
    // barely pushed: 20 cup catches were worth 5 points.)
    const board = this.stage.table.board
    if (board) return { x, y: board.bottomY - SKIRT / 2, z: board.z }
    return { x, y: BONUS_POUR.y, z: BONUS_POUR.z }
  }

  private towerClock = 0

  /** Coins high on each tower post, right now. */
  measureTowers(): number[] {
    const coins: CoinState[] = []
    for (const puck of this.engine.pucks) {
      if (!puck.active) continue
      const p = puck.body.translation()
      coins.push({ x: p.x, y: p.y, z: p.z, vy: puck.body.linvel().y })
    }
    return this.towerPosts.map(post => measureTower(this.postAt(post, this.engine.time), coins))
  }

  setCannonMode(mode: 'hold' | 'tap') {
    this.cannonMode = mode
  }

  /** 1 is normal; lower slows the arm and ring without slowing gravity. */
  setSpeed(speed: number) {
    this.speed = speed
  }

  dispose() {
    this.engine.dispose()
  }
}
