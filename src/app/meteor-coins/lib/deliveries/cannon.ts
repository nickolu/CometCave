import { BACK_WALL_Z, DROP_Z, PHYSICS_STEP_S, PUCK_RADIUS } from '@/app/meteor-coins/lib/cabinet'
import {
  type CannonConfig,
  type Vec,
  chargeAfter,
  dropsThroughHoop,
  flightPath,
  hoopReady,
  hoopX,
  launchVelocity,
  lineByHoop,
  linesUp,
  muzzleAt,
  swingSpeed,
} from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { GameEvent } from '@/app/meteor-coins/lib/game'
import { hoopHit, shotLanded } from '@/app/meteor-coins/lib/rules'

/** A fired coin is done once it's below the hoops and falling, or after this long. */
const SHOT_TIMEOUT_S = 3
/** Where hoop bonuses pour: across the back of the shelf, from the backboard. */
const BONUS_POUR = { y: 2.5, z: DROP_Z, halfWidth: 2.6 }
/** The aim line: a dash this far apart, from the muzzle back to the back wall. */
const AIM_LINE_STEP = 0.3

/**
 * Where the aim line passes a hoop; whether the hoop is ready (it'll still
 * be there when a shot arrives); and whether it's lined up: ready, and a
 * coin sent along the line fits through.
 */
export type AimMark = { x: number; y: number; z: number; ready: boolean; linedUp: boolean }

/**
 * Hoop-La Cannon's delivery (see lib/cannon for the aim and the arc), in
 * two steps. While the cannon swings, a line out to the hoops shows the
 * direction, lighting each hoop it lines up with, and a press locks it. Then a press starts the charge and
 * letting go fires; the dotted arc shows the distance, growing with the
 * charge. In tap mode a third tap fires instead of letting go. Fired
 * coins are watched down through the hoops until they come down.
 */
export class CannonDelivery implements Delivery {
  readonly kind = 'cannon'
  /** How the cannon is fired: hold and let go, or tap twice. */
  mode: 'hold' | 'tap' = 'hold'
  /** The direction locked by the first press, or null while the cannon swings. */
  private locked: number | null = null
  /**
   * How far round its swing the cannon is, in radians (the aim is maxYaw ×
   * its sine). Kept, not worked out from the clock, because the swing can
   * slow over a hoop (config.linger); it holds still while locked, so the
   * cannon picks up from where it fired.
   */
  private phase = 0
  /** When the second press started the charge, or null before it. */
  private chargingFrom: number | null = null
  /** Coins in the air, and where each was last step. */
  private fired: { index: number; firedAt: number; last: Vec; hoops: Set<number> }[] = []
  private pours = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: CannonConfig
  ) {}

  setMode(mode: 'hold' | 'tap') {
    this.mode = mode
  }

  /** Where the cannon points: locked after the first press, swinging before it. */
  get yaw(): number {
    return this.locked ?? this.config.maxYaw * Math.sin(this.phase)
  }

  /**
   * Where the swinging cannon will point `aheadS` of stage time from now,
   * for a bot judging a tap ahead as a person does.
   */
  yawAhead(aheadS: number): number {
    if (this.locked !== null) return this.locked
    let phase = this.phase
    let t = this.host.dropperTime
    const dt = PHYSICS_STEP_S * this.host.speed
    for (let left = aheadS; left > 0; left -= dt) {
      t += Math.min(dt, left)
      phase = this.swing(phase, t, Math.min(dt, left))
    }
    return this.config.maxYaw * Math.sin(phase)
  }

  /** The swing's phase after `dt` more of stage time, ending at time `t`. */
  private swing(phase: number, t: number, dt: number): number {
    const c = this.config
    const speed = swingSpeed(phase, t, c, PUCK_RADIUS)
    return (phase + ((2 * Math.PI) / c.periodS) * speed * dt) % (2 * Math.PI)
  }

  /** Swings the cannon on, unless the direction is locked. */
  beforeStep() {
    if (this.locked !== null) return
    this.phase = this.swing(this.phase, this.host.dropperTime, PHYSICS_STEP_S * this.host.speed)
  }

  /** Whether the direction is locked and the next step is the distance. */
  get isLocked(): boolean {
    return this.locked !== null
  }

  /** The charge so far, 0 to 1, or null when not charging. */
  get charge(): number | null {
    if (this.chargingFrom === null) return null
    return chargeAfter(this.host.dropperTime - this.chargingFrom, this.config)
  }

  /**
   * The line the cannon points down, while it swings, back to the back
   * wall. Seen from above it's the coin's path whatever the charge. It
   * climbs from the muzzle to each hoop's rim height at that hoop's depth,
   * so on screen it runs through a rim exactly when the cannon points
   * through it (a line level with the muzzle passed under the hoops, and
   * judging it against them was guesswork). Empty once locked.
   */
  aimLine(): Vec[] {
    if (this.locked !== null) return []
    const yaw = this.yaw
    const start = muzzleAt(yaw, this.config)
    // Heights to climb through, nearest first.
    const knots = [{ z: start.z, y: start.y }, ...this.config.hoops.map(h => ({ z: h.z, y: h.y }))]
    knots.sort((a, b) => b.z - a.z)
    const heightAt = (z: number) => {
      for (let i = 1; i < knots.length; i++) {
        const a = knots[i - 1]
        const b = knots[i]
        if (z >= b.z) return a.y + ((b.y - a.y) * (a.z - z)) / (a.z - b.z)
      }
      return knots[knots.length - 1].y
    }
    const points: Vec[] = []
    for (let d = AIM_LINE_STEP; ; d += AIM_LINE_STEP) {
      const x = start.x + d * Math.sin(yaw)
      const z = start.z - d * Math.cos(yaw)
      if (z < BACK_WALL_Z + 0.3) break
      points.push({ x, y: heightAt(z), z })
    }
    return points
  }

  /**
   * For each hoop, where the aim (swinging or locked) passes it at its rim
   * height, and whether it's lined up: a coin sent that way fits through
   * the rim, and the hoop will still be standing there when it arrives
   * (hoopReady). This is what lights a hoop.
   */
  aimMarks(): AimMark[] {
    const yaw = this.yaw
    const t = this.host.dropperTime
    return this.config.hoops.map(hoop => {
      const x = hoopX(hoop, t)
      const at = lineByHoop(yaw, hoop, x, this.config)
      const ready = hoopReady(hoop, t, this.config)
      const linedUp = ready && linesUp(yaw, hoop, x, this.config, PUCK_RADIUS)
      return { x: at.x, y: hoop.y, z: at.z, ready, linedUp }
    })
  }

  /**
   * The arc a shot would fly at the charge so far (none yet is the
   * shortest shot), once the direction is locked. Empty while it swings.
   */
  previewPath(): Vec[] {
    if (this.locked === null) return []
    return this.arcAt(this.locked, this.charge ?? 0)
  }

  private arcAt(yaw: number, power: number): Vec[] {
    const v = launchVelocity(yaw, power, this.config)
    return flightPath(muzzleAt(yaw, this.config), v, p => p.y < 0.7 || p.z < DROP_Z - 0.4)
  }

  get busy(): number {
    return this.fired.length + (this.locked !== null ? 1 : 0)
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'press') {
      if (!this.host.canDrop) return false
      if (this.locked === null) {
        this.locked = this.yaw
        return true
      }
      if (this.chargingFrom === null) {
        this.chargingFrom = this.host.dropperTime
        return true
      }
      return this.mode === 'tap' ? this.fire() : false
    }
    if (e.type === 'release') {
      return this.mode === 'hold' && this.chargingFrom !== null && this.fire()
    }
    return false
  }

  private fire(): boolean {
    const yaw = this.locked
    if (yaw === null || this.chargingFrom === null || !this.host.canDrop) return false
    const power = this.charge ?? 0
    const start = muzzleAt(yaw, this.config)
    const velocity = launchVelocity(yaw, power, this.config)
    const index = this.host.launch({ ...start, velocity })
    if (index === null) return false
    this.locked = null
    this.chargingFrom = null
    const firedAt = this.host.engine.time
    this.fired.push({ index, firedAt, last: start, hoops: new Set() })
    return true
  }

  /** Checks fired coins against the hoops, and settles the ones that have come down. */
  step(events: GameEvent[]) {
    const host = this.host
    const hoops = this.config.hoops
    // Below every rim and still falling, a coin can't go through one any more.
    const lowest = Math.min(...hoops.map(h => h.y)) - 0.2
    this.fired = this.fired.filter(shot => {
      const puck = host.engine.pucks[shot.index]
      if (!puck.active) {
        host.state = shotLanded(host.state)
        return false
      }
      const t = puck.body.translation()
      const now = { x: t.x, y: t.y, z: t.z }
      hoops.forEach((hoop, i) => {
        if (shot.hoops.has(i)) return
        const x = hoopX(hoop, host.dropperTime)
        if (!dropsThroughHoop(hoop, x, shot.last, now, puck.spec.reach)) return
        shot.hoops.add(i)
        host.state = hoopHit(host.state, hoop.bonus)
        events.push({ type: 'hoop', bonus: hoop.bonus })
      })
      shot.last = now
      const down = now.y < lowest && puck.body.linvel().y <= 0
      if (down || host.engine.time - shot.firedAt > SHOT_TIMEOUT_S) {
        host.state = shotLanded(host.state)
        return false
      }
      return true
    })
  }

  /** Hoop bonuses pour stepping across the back of the shelf, from the backboard. */
  bonusAt(): Vec {
    const x = BONUS_POUR.halfWidth * Math.sin(this.pours++ * 2.4)
    return { x, y: BONUS_POUR.y, z: BONUS_POUR.z }
  }
}
