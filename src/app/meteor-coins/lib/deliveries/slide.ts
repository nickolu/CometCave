import { GRAVITY, PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'
import { type Vec, flightPath } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'

/**
 * Rubber Ducky Rumble's waterslide: a slide hanging at the back of the tub
 * that sways side to side on its own. A press sends the next duck down it;
 * the duck picks up speed all the way down and shoots out of the lip onto
 * the water already sliding, so it hits the pile far harder than a dropped
 * duck would. Where the slide points when you press is where the duck goes.
 *
 * The slide holds still while a duck rides it, so the duck follows the
 * slide as drawn, and the dotted path shown before the press is the path
 * it flies. The ride is worked out here rather than left to a ramp body in
 * the physics (speed from the height dropped, held on the curve each step),
 * so every duck leaves the lip exactly as the preview says, and out of the
 * lip it's an ordinary body, flying the arc flightPath predicts. A riding
 * duck touches nothing (see `touches`).
 */

export type SlideConfig = {
  /** The top of the slide: where it hangs, and the point it turns about. */
  pivot: Vec
  /**
   * The slide seen side-on, from the top: its bend and its lip, each as how
   * far forward of the top (toward the player) and how high. It's a curve
   * through the top, pulled toward the bend, ending at the lip.
   */
  bend: { forward: number; y: number }
  lip: { forward: number; y: number }
  /** Seconds per full sway, and how far it swings either side of straight ahead (radians). */
  periodS: number
  maxYaw: number
  /**
   * The share of gravity that speeds a duck down the slope; the rest is
   * lost to the water running down it. Speed comes from the drop alone, so
   * a steeper or taller slide is faster.
   */
  pull: number
  /** How fast a duck is pushed off the top. */
  startSpeed: number
}

/** Points along the slide's curve: enough that the duck rides it smoothly. */
const SAMPLES = 48
/** Collision groups (membership and filter): everything, the default, and nothing. */
const ALL_GROUPS = 0xffffffff
const NO_GROUPS = 0
/** The dotted path ends once a duck is this low: on the water. */
const WATER_Y = 0.3

/** A point on the slide, in its own frame: forward of the top, and height. */
type SidePoint = { forward: number; y: number }

/** The slide's curve, side-on, from top to lip, with the distance along it to each point. */
export function slideCurve(c: SlideConfig): { points: SidePoint[]; along: number[] } {
  const top = { forward: 0, y: c.pivot.y }
  const points: SidePoint[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const a = (1 - t) * (1 - t)
    const b = 2 * t * (1 - t)
    const d = t * t
    points.push({
      forward: a * top.forward + b * c.bend.forward + d * c.lip.forward,
      y: a * top.y + b * c.bend.y + d * c.lip.y,
    })
  }
  const along = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].forward - points[i - 1].forward
    const dy = points[i].y - points[i - 1].y
    along.push(along[i - 1] + Math.hypot(dx, dy))
  }
  return { points, along }
}

/** Where the slide points at sway clock `t`: radians off straight ahead, positive to the right. */
export function slideYaw(t: number, c: SlideConfig): number {
  return c.maxYaw * Math.sin((2 * Math.PI * t) / c.periodS)
}

/** A point on the slide, in the world, with the slide turned to `yaw`. */
export function onSlide(p: SidePoint, yaw: number, c: SlideConfig): Vec {
  return {
    x: c.pivot.x + p.forward * Math.sin(yaw),
    y: p.y,
    z: c.pivot.z + p.forward * Math.cos(yaw),
  }
}

/** How fast a duck is going after dropping `drop` down the slide. */
export function rideSpeed(drop: number, c: SlideConfig): number {
  return Math.sqrt(c.startSpeed ** 2 + 2 * -GRAVITY * c.pull * Math.max(0, drop))
}

/** Where a duck leaves the slide turned to `yaw`, and how fast, in which direction. */
export function slideExit(
  yaw: number,
  c: SlideConfig,
  curve = slideCurve(c)
): { at: Vec; velocity: Vec } {
  const { points } = curve
  const last = points[points.length - 1]
  const before = points[points.length - 2]
  const df = last.forward - before.forward
  const dy = last.y - before.y
  const len = Math.hypot(df, dy)
  const speed = rideSpeed(c.pivot.y - last.y, c)
  return {
    at: onSlide(last, yaw, c),
    velocity: {
      x: ((speed * df) / len) * Math.sin(yaw),
      y: (speed * dy) / len,
      z: ((speed * df) / len) * Math.cos(yaw),
    },
  }
}

/** The arc a duck flies out of the lip with the slide turned to `yaw`, down to the water. */
export function slideFlight(yaw: number, c: SlideConfig, curve = slideCurve(c)): Vec[] {
  const { at, velocity } = slideExit(yaw, c, curve)
  return flightPath(at, velocity, p => p.y < WATER_Y)
}

/** Seconds a duck takes to ride from the top of the slide out of its lip. */
export function rideTime(c: SlideConfig, curve = slideCurve(c)): number {
  const length = curve.along[curve.along.length - 1]
  let s = 0
  let speed = c.startSpeed
  let steps = 0
  while (s < length) {
    s += speed * PHYSICS_STEP_S
    steps++
    const i = curve.along.findIndex(d => d >= s)
    const y = i < 0 ? c.lip.y : curve.points[i].y
    speed = rideSpeed(c.pivot.y - y, c)
  }
  return steps * PHYSICS_STEP_S
}

/**
 * A duck's facing on the slide: beak (its +x) pointing down the slope,
 * tipped nose-down by `pitch`, with the slide turned to `yaw`.
 */
export function rideRotation(yaw: number, pitch: number) {
  const a = (yaw - Math.PI / 2) / 2
  const b = -pitch / 2
  const [sy, cy, sz, cz] = [Math.sin(a), Math.cos(a), Math.sin(b), Math.cos(b)]
  return { x: sy * sz, y: cz * sy, z: cy * sz, w: cy * cz }
}

export class SlideDelivery implements Delivery {
  readonly kind = 'slide'
  /** The sway's own clock: it runs on the stage clock, but stops while a duck rides. */
  private swayClock = 0
  /** The duck on the slide: its index, the slide's yaw, how far down it is and how fast. */
  private riding: { index: number; yaw: number; s: number; speed: number } | null = null
  private readonly curve: ReturnType<typeof slideCurve>
  /** Where the last duck hit the water, and when (physics time), for the splash. */
  splash: { x: number; z: number; at: number } | null = null

  constructor(
    private readonly host: DeliveryHost,
    readonly config: SlideConfig
  ) {
    this.curve = slideCurve(config)
  }

  /** Where the slide points now. */
  get yaw(): number {
    return this.riding ? this.riding.yaw : slideYaw(this.swayClock, this.config)
  }

  /** The slide's curve, side-on (for the rig to draw). */
  get points(): readonly SidePoint[] {
    return this.curve.points
  }

  /** Whether a duck is on its way down. */
  get rideOn(): boolean {
    return this.riding !== null
  }

  get busy(): number {
    return this.riding ? 1 : 0
  }

  /** Whether a press now would send a duck. */
  get ready(): boolean {
    return !this.riding && this.host.canDrop
  }

  /** The dotted path a duck sent now would fly out of the lip. */
  previewPath(): Vec[] {
    return slideFlight(this.yaw, this.config, this.curve)
  }

  /** Where the slide will point `ahead` seconds from now, if no duck rides it meanwhile. */
  yawAfter(ahead: number): number {
    if (this.riding) return this.riding.yaw
    return slideYaw(this.swayClock + ahead * this.host.speed, this.config)
  }

  input(e: DeliveryInput): boolean {
    if (e.type !== 'press' || !this.ready) return false
    const yaw = this.yaw
    const top = onSlide(this.curve.points[0], yaw, this.config)
    const index = this.host.launch({ ...top, velocity: { x: 0, y: 0, z: 0 } })
    if (index === null) return false
    this.riding = { index, yaw, s: 0, speed: this.config.startSpeed }
    this.touches(index, false)
    this.place(this.riding)
    return true
  }

  beforeStep() {
    if (!this.riding) {
      this.swayClock += PHYSICS_STEP_S * this.host.speed
      return
    }
    const ride = this.riding
    const { along } = this.curve
    const length = along[along.length - 1]
    ride.s += ride.speed * PHYSICS_STEP_S
    if (ride.s >= length) {
      this.letGo(ride)
      return
    }
    this.place(ride)
    ride.speed = rideSpeed(this.config.pivot.y - this.sideAt(ride.s).y, this.config)
  }

  step() {}

  /** The slide's curve at distance `s` along it, and its slope there (radians, nose-down positive). */
  private sideAt(s: number): SidePoint & { pitch: number } {
    const { along, points } = this.curve
    let i = 1
    while (i < along.length - 1 && along[i] < s) i++
    const a = points[i - 1]
    const b = points[i]
    const k = Math.min(1, Math.max(0, (s - along[i - 1]) / (along[i] - along[i - 1])))
    return {
      forward: a.forward + (b.forward - a.forward) * k,
      y: a.y + (b.y - a.y) * k,
      pitch: Math.atan2(a.y - b.y, b.forward - a.forward),
    }
  }

  /**
   * Whether a duck bumps into things. On the slide it doesn't: the slide
   * runs low over the pusher, and a duck riding through the heads of ducks
   * on its top threw them out of the tub.
   */
  private touches(index: number, on: boolean) {
    const body = this.host.engine.pucks[index].body
    for (let i = 0; i < body.numColliders(); i++) {
      body.collider(i).setCollisionGroups(on ? ALL_GROUPS : NO_GROUPS)
    }
  }

  /** Holds the riding duck on the slide, moving down it at its speed. */
  private place(ride: { index: number; yaw: number; s: number; speed: number }) {
    const body = this.host.engine.pucks[ride.index].body
    const side = this.sideAt(ride.s)
    const at = onSlide(side, ride.yaw, this.config)
    const flat = ride.speed * Math.cos(side.pitch)
    body.setTranslation(at, true)
    body.setRotation(rideRotation(ride.yaw, side.pitch), true)
    body.setLinvel(
      {
        x: flat * Math.sin(ride.yaw),
        y: -ride.speed * Math.sin(side.pitch),
        z: flat * Math.cos(ride.yaw),
      },
      true
    )
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  /** Out of the lip: from here the duck is the physics' own. */
  private letGo(ride: { index: number; yaw: number }) {
    const { at, velocity } = slideExit(ride.yaw, this.config, this.curve)
    const body = this.host.engine.pucks[ride.index].body
    const last = this.curve.points[this.curve.points.length - 1]
    const before = this.curve.points[this.curve.points.length - 2]
    body.setTranslation(at, true)
    body.setRotation(
      rideRotation(ride.yaw, Math.atan2(before.y - last.y, last.forward - before.forward)),
      true
    )
    body.setLinvel(velocity, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.touches(ride.index, true)
    const flight = slideFlight(ride.yaw, this.config, this.curve)
    const end = flight[flight.length - 1]
    this.splash = {
      x: end.x,
      z: end.z,
      at: this.host.engine.time + (flight.length - 1) * PHYSICS_STEP_S,
    }
    this.riding = null
  }
}
