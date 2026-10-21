import { PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'
import { RING_Y, armTip, isHit } from '@/app/meteor-coins/lib/dropper'
import { type EngineOptions, PusherEngine } from '@/app/meteor-coins/lib/engine'
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
  tick,
} from '@/app/meteor-coins/lib/rules'
import type { StageDef } from '@/app/meteor-coins/lib/stages'
import { fallTimeToShelf, shelfOpenAt } from '@/app/meteor-coins/lib/timing'

/**
 * A shot that hasn't passed the ring by now is a miss — it landed on a pile
 * taller than the ring. Without this, that shot would never resolve and the
 * game could never end (a 3-layer sim ran 200s instead of ~70s). A clean drop
 * reaches the ring in well under half a second.
 */
const SHOT_TIMEOUT_S = 1.5

/** One bonus coin every this many physics steps — 25 coins pour out in 2.5s. */
const SHOWER_INTERVAL_STEPS = 6

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

  /** Call initPhysics() first. `options` overrides the stage's engine setup, for tests. */
  constructor(stage: StageDef, options: EngineOptions = {}) {
    this.stage = stage
    this.state = initialState(stage.rules)
    this.engine = new PusherEngine({
      poolObject: stage.objects.drop,
      pile: PILES[stage.pile],
      chuteHalfWidth: stage.table.chuteHalfWidth,
      pusherPeriodS: stage.table.pusherPeriodS,
      obstacles: stage.table.obstacles,
      ...options,
    })
  }

  /** Where a puck released now would start. */
  armTip() {
    return armTip(this.dropperTime, this.stage.arm.periodS)
  }

  get canDrop() {
    return canDrop(this.state) && this.engine.freeCount > 0
  }

  /** Whether a coin released now would land on bare shelf (see lib/timing). */
  get dropLandsClear() {
    const landsAt = this.engine.time + fallTimeToShelf(this.armTip().y)
    return shelfOpenAt(landsAt, this.engine.pusherPeriodS)
  }

  /** The player's tap. Returns false if there was nothing to drop. */
  tapDrop(): boolean {
    if (!this.canDrop) return false
    const tip = this.armTip()
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

    this.state = tick(this.state, this.engine.time, this.inFlight.length, this.stage.rules)
    return events
  }

  /** 1 is normal; lower slows the arm and ring without slowing gravity. */
  setSpeed(speed: number) {
    this.speed = speed
  }

  dispose() {
    this.engine.dispose()
  }
}
