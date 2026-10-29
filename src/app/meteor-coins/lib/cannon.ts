import { sweeperX } from '@/app/meteor-coins/lib/board'
import { GRAVITY, LINEAR_DAMPING, PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'

/**
 * Hoop-La Cannon's launcher: a cannon at the front of the cabinet that lobs
 * coins back over the pile, down through hoops that lie flat above it like
 * basketball hoops.
 *
 * Aiming takes two steps. The cannon swings left and right on its own; a
 * first press locks the direction. Then a second press starts the charge:
 * how long it's held sets the distance (the charge fills in `chargeS` and
 * stops), and letting go fires. Players who'd rather not hold can tap a
 * third time to fire instead.
 *
 * The arc is exact: it's worked out the way the physics steps a body, so
 * the dotted preview is the path the coin flies until it touches something.
 */

/**
 * The physics splits each step into 4 sub-steps, adding gravity to the
 * velocity before each move, then damps once at the end. So within a step
 * a body falls as if it had (1+2+3+4)/16 of the step's gravity already
 * (measured: matches to the last digit printed).
 */
const SUBSTEP_GRAVITY = 10 / 16

export type Vec = { x: number; y: number; z: number }

/** How far each hoop's backboard (and the bonus written on it) stands above its rim. */
export const HOOP_BOARD_TOP = 0.8

/**
 * A hoop lying flat, like a basketball hoop: a coin that drops down through
 * it pours `bonus` more. `radius` is the inside of the rim. One with a
 * `sweep` slides left and right along its track (see hoopX).
 */
export type Hoop = {
  x: number
  y: number
  z: number
  radius: number
  bonus: number
  sweep?: { ampX: number; periodS: number }
}

export type CannonConfig = {
  /** The point the barrel turns about, and its length to the muzzle. */
  pivot: Vec
  barrel: number
  /** Seconds per full swing of the aim. */
  periodS: number
  /** How far the aim swings either side of straight back, in radians. */
  maxYaw: number
  /** The barrel's fixed upward angle, in radians. */
  elevation: number
  /** Launch speed with no charge, and with a full one. */
  minSpeed: number
  maxSpeed: number
  /** Seconds of holding to fill the charge. */
  chargeS: number
  hoops: readonly Hoop[]
}

/** The aim at dropper time `t`: radians off straight back, positive to the right. */
export function cannonYaw(t: number, c: CannonConfig): number {
  return c.maxYaw * Math.sin((2 * Math.PI * t) / c.periodS)
}

/** Charge from 0 to 1 after holding for `heldS`. */
export function chargeAfter(heldS: number, c: CannonConfig): number {
  return Math.min(1, Math.max(0, heldS / c.chargeS))
}

/** Where a fired coin starts: the end of the barrel. */
export function muzzleAt(yaw: number, c: CannonConfig): Vec {
  const flat = c.barrel * Math.cos(c.elevation)
  return {
    x: c.pivot.x + flat * Math.sin(yaw),
    y: c.pivot.y + c.barrel * Math.sin(c.elevation),
    z: c.pivot.z - flat * Math.cos(yaw),
  }
}

export function launchVelocity(yaw: number, power: number, c: CannonConfig): Vec {
  const speed = c.minSpeed + power * (c.maxSpeed - c.minSpeed)
  const flat = speed * Math.cos(c.elevation)
  return { x: flat * Math.sin(yaw), y: speed * Math.sin(c.elevation), z: -flat * Math.cos(yaw) }
}

/**
 * The arc a coin fired now would fly, step by step, until `stop` says it's
 * done. `accel` is any pull besides gravity (Gravity Assist's moon), given
 * where the body is and which step it's on, applied as the game applies
 * it: added to the velocity just before each physics step. `gravity` is
 * the world's, where a stage changes it.
 */
export function flightPath(
  start: Vec,
  velocity: Vec,
  stop: (p: Vec) => boolean,
  maxSteps = 240,
  accel?: (p: Vec, step: number) => Vec,
  gravity = GRAVITY
): Vec[] {
  const dt = PHYSICS_STEP_S
  const damp = 1 / (1 + dt * LINEAR_DAMPING)
  let { x, y, z } = start
  let { x: vx, y: vy, z: vz } = velocity
  const points: Vec[] = [{ x, y, z }]
  for (let i = 0; i < maxSteps; i++) {
    if (accel) {
      const a = accel({ x, y, z }, i)
      vx += a.x * dt
      vy += a.y * dt
      vz += a.z * dt
    }
    x += vx * dt
    y += (vy + gravity * dt * SUBSTEP_GRAVITY) * dt
    z += vz * dt
    vy += gravity * dt
    vx *= damp
    vy *= damp
    vz *= damp
    points.push({ x, y, z })
    if (stop({ x, y, z })) break
  }
  return points
}

/** Where a hoop's center is across the table at stage time `t`: it may slide. */
export function hoopX(hoop: Hoop, t: number): number {
  return hoop.sweep ? hoop.x + sweeperX(hoop.sweep, t) : hoop.x
}

/**
 * Whether a coin moving from `from` to `to` (one step) dropped down through
 * a flat hoop centered at `x`: it crossed the rim's height going down, with
 * the whole coin inside the rim. A flying coin lies flat, so it fits when
 * its center is within the rim's radius less its own.
 */
export function dropsThroughHoop(
  hoop: Hoop,
  x: number,
  from: Vec,
  to: Vec,
  coinRadius: number
): boolean {
  if (!(from.y > hoop.y && to.y <= hoop.y)) return false
  const k = (from.y - hoop.y) / (from.y - to.y)
  const dx = from.x + (to.x - from.x) * k - x
  const dz = from.z + (to.z - from.z) * k - hoop.z
  const room = hoop.radius - coinRadius
  return room > 0 && dx * dx + dz * dz <= room * room
}

/**
 * Whether a coin moving from `from` to `to` (one step) went through an
 * upright hoop facing the player (how the hoops first hung; kept for any
 * stage that wants one): it crossed the hoop's plane with the whole coin
 * inside the rim. A flying
 * coin lies flat, so what has to fit is a strip as wide as the coin and as
 * tall as it is thick.
 */
export function throughHoop(
  hoop: Hoop,
  from: Vec,
  to: Vec,
  halfWidth: number,
  halfHeight: number
): boolean {
  if (!(from.z > hoop.z && to.z <= hoop.z)) return false
  const k = (from.z - hoop.z) / (from.z - to.z)
  const dx = Math.abs(from.x + (to.x - from.x) * k - hoop.x) + halfWidth
  const dy = Math.abs(from.y + (to.y - from.y) * k - hoop.y) + halfHeight
  return dx * dx + dy * dy <= hoop.radius * hoop.radius
}
