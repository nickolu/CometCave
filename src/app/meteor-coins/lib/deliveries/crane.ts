import RAPIER from '@dimforge/rapier3d-compat'

import { GRAVITY, PHYSICS_STEP_S, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import { type Vec, flightPath } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'

/**
 * A claw crane over the shelf: a trolley that runs on a gantry in both x
 * and z, with the claw hanging below it on a cable.
 *
 * The pointer sets where the trolley should go and it glides there at a
 * limited speed; held arrow keys drive it instead. The claw hangs on a
 * cable, so it trails the trolley and swings a little when it starts and
 * stops (a damped pendulum). A press opens the claw: the coin falls from
 * where the claw is, moving as the claw was, so letting go mid-swing lands
 * off. Then the claw reloads for a moment before it can drop again.
 *
 * A mouse hovering keeps the target under the pointer, so a click drops
 * wherever the claw has got to. On touch there's no hover: a tap well away
 * from where the claw was last sent only sends it there, and the next tap
 * in the same place drops (or drag, and tap where you let go).
 */
export type CraneConfig = {
  /** Height of the claw (where the coin starts falling from). */
  y: number
  /** How far the claw can go, in x and in z. */
  x: readonly [number, number]
  z: readonly [number, number]
  /** Top speed of the trolley, units per second, and how fast it gets there. */
  speed: number
  accel: number
  /** Cable length: sets how slowly the claw swings (period 2π·√(L/g)). */
  cable: number
  /** Share of critical damping on the swing: 0 swings forever, 1 never overshoots. */
  damping: number
  /** Seconds, on the stage clock, to pick up the next coin after a drop. */
  reloadS: number
  /** Where the trolley starts. */
  start: { x: number; z: number }
}

/** A press this far (or less) from where the claw was already sent drops; further, it only aims. */
export const AIM_ARRIVED = 0.6
/** Within this of its target the trolley slows to arrive rather than overshoot. */
const ARRIVE_EASE = 0.8
/** The pointer is read, and the landing marker drawn, at about the top of the pile. */
export const CRANE_AIM_Y = 0.8

type Planar = { x: number; z: number }

export class CraneDelivery implements Delivery {
  readonly kind = 'crane'
  /** The trolley on the gantry, and its velocity. */
  readonly trolley: Planar
  private trolleyV: Planar = { x: 0, z: 0 }
  /** The claw's offset from under the trolley (the swing), and its rate. */
  private sway: Planar = { x: 0, z: 0 }
  private swayV: Planar = { x: 0, z: 0 }
  /** Where the pointer last asked the trolley to go; null when keys drive it. */
  private target: Planar | null = null
  /** The target before the latest point: where the claw had been sent when a press comes. */
  private sentTo: Planar | null = null
  private steering: Planar = { x: 0, z: 0 }
  /** Stage-clock time the claw holds a coin again. */
  private loadedAt = 0
  private pours = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: CraneConfig
  ) {
    this.trolley = { ...config.start }
  }

  /** Where the claw is now, and the coin with it. */
  get claw(): Vec {
    return { x: this.trolley.x + this.sway.x, y: this.config.y, z: this.trolley.z + this.sway.z }
  }

  /** How the claw is moving, per second of physics time (a coin let go keeps this). */
  get clawVelocity(): Vec {
    const k = this.host.speed
    return {
      x: (this.trolleyV.x + this.swayV.x) * k,
      y: 0,
      z: (this.trolleyV.z + this.swayV.z) * k,
    }
  }

  /** How far the claw is swinging out from under the trolley. */
  get swing(): number {
    return Math.hypot(this.sway.x, this.sway.z)
  }

  /** Whether the claw has its next coin. */
  get loaded(): boolean {
    return this.host.dropperTime >= this.loadedAt
  }

  /** 0 just after a drop, 1 once the next coin is in the claw. */
  get reload(): number {
    const left = this.loadedAt - this.host.dropperTime
    return left <= 0 ? 1 : 1 - left / this.config.reloadS
  }

  /** Where the trolley is heading: the pointer's target, or where it is. */
  get heading(): Planar {
    return this.target ?? this.trolley
  }

  /**
   * The path a coin let go now would fall, down to the top of whatever is
   * under it: worked out to about the top of the pile, then again to the
   * surface found under that point. Exact until it meets something.
   */
  fallPath(): Vec[] {
    const v = this.clawVelocity
    const velocity = { x: v.x, y: -1, z: v.z }
    const rough = flightPath(this.claw, velocity, p => p.y < CRANE_AIM_Y)
    const end = rough[rough.length - 1]
    const floor = this.surfaceY(end.x, end.z) + PUCK_THICKNESS / 2
    return flightPath(this.claw, velocity, p => p.y < floor)
  }

  /** The height of the top of whatever lies at (x, z): the pile, the pusher or the floor. */
  surfaceY(x: number, z: number): number {
    const from = this.config.y - 0.3
    const ray = new RAPIER.Ray({ x, y: from, z }, { x: 0, y: -1, z: 0 })
    const hit = this.host.engine.world.castRay(
      ray,
      from + 1,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
    )
    return hit ? from - hit.timeOfImpact : 0
  }

  /** Where a coin let go now would come down. */
  landing(): Vec {
    const path = this.fallPath()
    return path[path.length - 1]
  }

  get busy(): number {
    return 0
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'point') {
      this.sentTo = this.target
      this.target = this.clamp(e)
      return true
    }
    if (e.type === 'steer') {
      this.steering = { x: e.x, z: e.z }
      if (e.x !== 0 || e.z !== 0) this.target = this.sentTo = null
      return true
    }
    if (e.type !== 'press') return false
    // A tap well away from where the claw was sent: send it there first.
    const { target, sentTo } = this
    if (target) {
      this.sentTo = target
      const off = sentTo ? Math.hypot(target.x - sentTo.x, target.z - sentTo.z) : Infinity
      if (off > AIM_ARRIVED) return true
    }
    return this.drop()
  }

  private drop(): boolean {
    if (!this.loaded || !this.host.canDrop) return false
    const at = this.claw
    const v = this.clawVelocity
    const index = this.host.launch({
      x: at.x,
      y: at.y,
      z: at.z,
      velocity: { x: v.x, y: -1, z: v.z },
    })
    if (index === null) return false
    this.loadedAt = this.host.dropperTime + this.config.reloadS
    return true
  }

  /** Moves the trolley toward its target (or by the keys), and swings the claw after it. */
  beforeStep() {
    const c = this.config
    const dt = PHYSICS_STEP_S * this.host.speed
    // The velocity the trolley wants: toward the target, easing in as it
    // arrives, or the keys' direction at top speed.
    let want: Planar = { x: 0, z: 0 }
    if (this.target) {
      const dx = this.target.x - this.trolley.x
      const dz = this.target.z - this.trolley.z
      const d = Math.hypot(dx, dz)
      const s = d > 1e-4 ? (c.speed * Math.min(1, d / ARRIVE_EASE)) / d : 0
      want = { x: dx * s, z: dz * s }
    } else if (this.steering.x !== 0 || this.steering.z !== 0) {
      const n = Math.hypot(this.steering.x, this.steering.z)
      want = { x: (this.steering.x / n) * c.speed, z: (this.steering.z / n) * c.speed }
    }
    // Speeds up and slows down at a limited rate, like a real trolley.
    const ax = want.x - this.trolleyV.x
    const az = want.z - this.trolleyV.z
    const dv = Math.hypot(ax, az)
    const k = dv > c.accel * dt ? (c.accel * dt) / dv : 1
    const accel = { x: (ax * k) / dt, z: (az * k) / dt }
    this.trolleyV.x += ax * k
    this.trolleyV.z += az * k
    this.trolley.x += this.trolleyV.x * dt
    this.trolley.z += this.trolleyV.z * dt
    // Stopped at the gantry's ends.
    const held = this.clamp(this.trolley)
    if (held.x !== this.trolley.x) this.trolleyV.x = 0
    if (held.z !== this.trolley.z) this.trolleyV.z = 0
    this.trolley.x = held.x
    this.trolley.z = held.z
    // The claw: a damped pendulum hung from an accelerating point, so it
    // lags the trolley's speeding up and swings past when it stops.
    const w = Math.sqrt(-GRAVITY / c.cable)
    for (const axis of ['x', 'z'] as const) {
      const a = -w * w * this.sway[axis] - 2 * c.damping * w * this.swayV[axis] - accel[axis]
      this.swayV[axis] += a * dt
      this.sway[axis] += this.swayV[axis] * dt
    }
  }

  step() {}

  /** Bonus coins (where a stage pays any) pour from the claw. */
  bonusAt(): Vec {
    const at = this.claw
    return { ...at, x: at.x + 0.6 * Math.sin(this.pours++ * 2.4) }
  }

  private clamp(p: Planar): Planar {
    const { x, z } = this.config
    return {
      x: Math.min(x[1], Math.max(x[0], p.x)),
      z: Math.min(z[1], Math.max(z[0], p.z)),
    }
  }
}
