import { PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'
import { RING_Y, armTip, isHit } from '@/app/meteor-coins/lib/dropper'
import { type EngineOptions, PusherEngine } from '@/app/meteor-coins/lib/engine'
import {
  type GameState,
  bonusForStreak,
  canDrop,
  drop,
  fall,
  initialState,
  pourBonus,
  resolveShot,
  tick,
} from '@/app/meteor-coins/lib/rules'
import { STARTING_PILE } from '@/app/meteor-coins/lib/startingPile'

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
  | { type: 'fall'; result: 'chute' | 'gutter' }
  | { type: 'ring-open' }

/**
 * Fifty Coins: the engine, the swinging arm and the rules, stepped together.
 * Runs identically on screen and headless; the renderer only reads from it.
 */
export class DropGame {
  readonly engine: PusherEngine
  state: GameState = initialState()
  /** Arm and ring clock. Advances with physics time × speed. */
  dropperTime = 0
  speed = 1

  /** Player coins that haven't reached the ring's height yet. */
  private inFlight: { index: number; droppedAt: number }[] = []
  private showerCooldown = 0

  /** Call initPhysics() first. */
  constructor(options: EngineOptions = {}) {
    this.engine = new PusherEngine({ pile: STARTING_PILE, ...options })
  }

  /**
   * The ring stays hidden until the first point, so a player learns the
   * pusher before the skill shot. Coins dropped before then aren't shots:
   * they can't hit or miss, and don't touch the streak.
   */
  get ringActive() {
    return this.state.score > 0
  }

  get canDrop() {
    return canDrop(this.state) && this.engine.freeCount > 0
  }

  /** The player's tap. Returns false if there was nothing to drop. */
  tapDrop(): boolean {
    if (!this.canDrop) return false
    const tip = armTip(this.dropperTime)
    const index = this.engine.spawn(tip.x, tip.y, tip.z, 'player')
    if (index === null) return false
    this.state = drop(this.state)
    if (this.ringActive) this.inFlight.push({ index, droppedAt: this.engine.time })
    return true
  }

  step(): GameEvent[] {
    const events: GameEvent[] = []
    this.dropperTime += PHYSICS_STEP_S * this.speed

    const ringWasActive = this.ringActive
    for (const f of this.engine.step()) {
      this.state = fall(this.state, f.result, this.engine.time)
      events.push({ type: 'fall', result: f.result })
    }
    if (!ringWasActive && this.ringActive) events.push({ type: 'ring-open' })

    // A shot resolves on the step the coin's center passes the ring's height.
    this.inFlight = this.inFlight.filter(shot => {
      const puck = this.engine.pucks[shot.index]
      const y = puck.active ? puck.body.translation().y : -Infinity
      const timedOut = this.engine.time - shot.droppedAt > SHOT_TIMEOUT_S
      if (y > RING_Y && !timedOut) return true
      const hit = !timedOut && puck.active && isHit(puck.body.translation().x, this.dropperTime)
      this.state = resolveShot(this.state, hit)
      events.push({
        type: 'shot',
        hit,
        streak: this.state.streak,
        bonus: hit ? bonusForStreak(this.state.streak) : 0,
      })
      return false
    })

    if (this.state.showerLeft > 0 && --this.showerCooldown <= 0) {
      const tip = armTip(this.dropperTime)
      // A full pool waits rather than dropping the bonus; falls free slots up.
      if (this.engine.spawn(tip.x, tip.y, tip.z, 'bonus', this.engine.time * 3) !== null) {
        this.state = pourBonus(this.state)
        this.showerCooldown = SHOWER_INTERVAL_STEPS
      }
    }

    this.state = tick(this.state, this.engine.time, this.inFlight.length)
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
