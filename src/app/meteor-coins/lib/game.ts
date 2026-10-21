import { PHYSICS_STEP_S, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import { RING_Y, armTip, isHit } from '@/app/meteor-coins/lib/dropper'
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
  initialState,
  pourBonus,
  resolveShot,
  setTowers,
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

export type GameEvent =
  | { type: 'shot'; hit: boolean; bonus: number; streak: number }
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

  /** Player coins that haven't reached the ring's height yet. */
  private inFlight: { index: number; droppedAt: number }[] = []
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
      ...options,
    })
  }

  /** Where a puck released `ahead` seconds from now would start. */
  armTip(ahead = 0) {
    return armTip(this.dropperTime + ahead * this.speed, this.stage.arm)
  }

  get canDrop() {
    return canDrop(this.state) && this.engine.freeCount > 0
  }

  /** Whether a coin released now would land on bare shelf (see lib/timing). */
  get dropLandsClear() {
    const landsAt = this.engine.time + fallTimeToShelf(this.armTip().y)
    return shelfOpenAt(landsAt, this.engine.pusherPeriodS)
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

    if (this.state.showerLeft > 0 && --this.showerCooldown <= 0) {
      const tip = this.armTip()
      // A full pool waits rather than dropping the bonus; falls free slots up.
      if (this.engine.spawn(tip.x, tip.y, tip.z, 'bonus', this.engine.time * 3) !== null) {
        this.state = pourBonus(this.state)
        this.showerCooldown = SHOWER_INTERVAL_STEPS
      }
    }

    if (this.towerPosts.length && ++this.towerClock % TOWER_INTERVAL_STEPS === 0) {
      this.state = setTowers(this.state, this.measureTowers())
    }

    this.state = tick(this.state, this.engine.time, this.inFlight.length, this.stage.rules)
    return events
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

  /** 1 is normal; lower slows the arm and ring without slowing gravity. */
  setSpeed(speed: number) {
    this.speed = speed
  }

  dispose() {
    this.engine.dispose()
  }
}
