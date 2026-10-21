import {
  DROP_Z,
  type Deck,
  PHYSICS_STEP_S,
  PUCK_THICKNESS,
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
import type { ObjectSpec } from '@/app/meteor-coins/lib/objects'
import { PILES } from '@/app/meteor-coins/lib/piles'
import {
  type GameState,
  canDrop,
  drop,
  fall,
  hoopHit,
  initialState,
  pourBonus,
  resolveShot,
  setTowers,
  shotLanded,
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
/** A fired coin flies flat, so half its thickness is what has to clear a hoop's rim above and below. */
const FLAT_COIN_HALF_HEIGHT = PUCK_THICKNESS / 2

export type GameEvent =
  | { type: 'shot'; hit: boolean; bonus: number; streak: number }
  | { type: 'hoop'; bonus: number }
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

  /** Player coins that haven't reached the ring's height yet. */
  private inFlight: { index: number; droppedAt: number }[] = []
  /** Coins fired from the cannon still in the air, and where each was last step. */
  private fired: { index: number; firedAt: number; last: Vec; hoops: Set<number> }[] = []
  /** How the cannon is fired: hold and let go, or tap twice. */
  cannonMode: 'hold' | 'tap' = 'hold'
  /** While charging: the aim locked by the press, and when it was pressed. */
  private charging: { yaw: number; from: number } | null = null
  /** The last shot's charge: the arc shown while aiming. A first shot previews full. */
  private lastPower = 1
  private showerCooldown = 0
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
      ...options,
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
    return canDrop(this.state) && this.engine.freeCount > 0
  }

  /** Whether a coin released now would land on bare shelf (see lib/timing). */
  get dropLandsClear() {
    const deck = this.dropDeck
    const landsAt = this.engine.time + fallTimeToShelf(this.armTip().y, deck.floorY)
    return shelfOpenAt(landsAt, this.engine.pusherPeriodS, deck.pusher.lagS)
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
    const index = this.engine.spawn(tip.x, tip.y, tip.z, 'player')
    if (index === null) return false
    this.state = drop(this.state)
    this.line = (this.line + 1) % dropLines(this.stage.arm).length
    if (this.stage.ring.enabled) this.inFlight.push({ index, droppedAt: this.engine.time })
    return true
  }

  step(): GameEvent[] {
    const events: GameEvent[] = []
    this.dropperTime += PHYSICS_STEP_S * this.speed

    for (const f of this.engine.step()) {
      this.state = fall(this.state, f.result, this.engine.time, f.spec, this.stage.rules)
      events.push({ type: 'fall', result: f.result, object: f.spec })
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
        isHit(puck.body.translation().x, this.dropperTime, puck.spec.reach)
      this.state = resolveShot(this.state, hit, this.stage.rules)
      events.push({
        type: 'shot',
        hit,
        streak: this.state.streak,
        bonus: hit ? this.stage.rules.bonusForStreak(this.state.streak) : 0,
      })
      return false
    })

    this.trackFired(events)

    if (this.state.showerLeft > 0 && --this.showerCooldown <= 0) {
      const tip = this.cannon ? this.bonusPour() : this.armTip()
      // A full pool waits rather than dropping the bonus; falls free slots up.
      if (this.engine.spawn(tip.x, tip.y, tip.z, 'bonus', this.engine.time * 3) !== null) {
        this.state = pourBonus(this.state)
        this.showerCooldown = SHOWER_INTERVAL_STEPS
      }
    }

    if (this.towerPosts.length && ++this.towerClock % TOWER_INTERVAL_STEPS === 0) {
      this.state = setTowers(this.state, this.measureTowers())
    }

    const flying = this.inFlight.length + this.fired.length + (this.charging ? 1 : 0)
    this.state = tick(this.state, this.engine.time, flying, this.stage.rules)
    return events
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
