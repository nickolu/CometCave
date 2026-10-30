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
 * `sweep` slides left and right along its track without stopping; one with
 * a `glide` moves between rest stops along it (see hoopX).
 */
export type Hoop = {
  x: number
  y: number
  z: number
  radius: number
  bonus: number
  sweep?: { ampX: number; periodS: number }
  glide?: HoopGlide
}

/**
 * Rest stops along a hoop's track, as offsets from its `x`, visited in
 * order and round again. It stands still at each for `dwellS`, then takes
 * `moveS` to glide to the next, easing out and in, so a player can aim at
 * it standing still and see it set off well before it goes.
 */
export type HoopGlide = { stops: readonly number[]; dwellS: number; moveS: number }

export type CannonConfig = {
  /** The point the barrel turns about, and its length to the muzzle. */
  pivot: Vec
  barrel: number
  /** Seconds per full swing of the aim (before any lingering, below). */
  periodS: number
  /**
   * If set, the swing slows while the aim is lined up with a hoop standing
   * still, so its line crosses the hoop no faster than this, in table
   * units a second, and each lined-up moment lasts long enough to see and
   * tap (see swingSpeed). Without it the swing never changes speed.
   */
  linger?: number
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

/**
 * How fast the swing goes (1 is its usual speed) at `phase` round it, at
 * stage time `t`. With `c.linger`, while the aim is lined up with a hoop
 * that's ready (see hoopReady), it slows so that its line sweeps across the hoop no
 * faster than `linger` (table units a second), easing back to full speed
 * by the time the line is three times as far off center as lines up. So
 * every lined-up moment lasts about as long, near or far, where the swing
 * is quick or already slowing to turn.
 */
export function swingSpeed(phase: number, t: number, c: CannonConfig, coinRadius: number): number {
  if (c.linger === undefined) return 1
  const yaw = c.maxYaw * Math.sin(phase)
  // Radians a second at full speed, here in the swing.
  const turn = ((2 * Math.PI) / c.periodS) * c.maxYaw * Math.abs(Math.cos(phase))
  let speed = 1
  for (const hoop of c.hoops) {
    if (!hoopReady(hoop, t, c)) continue
    const room = hoop.radius - coinRadius
    if (room <= 0) continue
    const x = hoopX(hoop, t)
    const u = lineByHoop(yaw, hoop, x, c).off / room
    if (u >= 3) continue
    const across = turn * Math.hypot(x - c.pivot.x, hoop.z - c.pivot.z)
    const slow = Math.min(1, c.linger / Math.max(across, 1e-6))
    const k = u <= 1 ? 1 : 1 - smooth((u - 1) / 2)
    speed = Math.min(speed, 1 - (1 - slow) * k)
  }
  return speed
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u)
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

/** Where a hoop's center is across the table at stage time `t`: it may slide or glide. */
export function hoopX(hoop: Hoop, t: number): number {
  if (hoop.glide) return hoop.x + glideX(hoop.glide, t)
  return hoop.sweep ? hoop.x + sweeperX(hoop.sweep, t) : hoop.x
}

/** Which leg of a glide `t` is in, and how far into it. */
function glideLeg(g: HoopGlide, t: number): { from: number; to: number; into: number } {
  const leg = g.dwellS + g.moveS
  const n = g.stops.length
  const k = Math.floor(t / leg)
  const from = ((k % n) + n) % n
  return { from: g.stops[from], to: g.stops[(from + 1) % n], into: t - k * leg }
}

function glideX(g: HoopGlide, t: number): number {
  const { from, to, into } = glideLeg(g, t)
  if (into <= g.dwellS) return from
  const u = (into - g.dwellS) / g.moveS
  return from + ((to - from) * (1 - Math.cos(Math.PI * u))) / 2
}

/**
 * How much longer a hoop stands where it is from stage time `t`: forever
 * for a fixed one, 0 for one that's moving (a sweep never stops).
 */
export function hoopRestLeft(hoop: Hoop, t: number): number {
  if (hoop.glide) {
    const { into } = glideLeg(hoop.glide, t)
    return Math.max(0, hoop.glide.dwellS - into)
  }
  return hoop.sweep ? 0 : Infinity
}

/**
 * Time to tap again, charge fully and fly to the farthest hoop (measured:
 * 1.25s to the +10), with a moment to spare.
 */
const SHOT_S = 1.6

/**
 * Whether a hoop at stage time `t` will still be where it is when a shot
 * aimed at it now gets there: fixed, or resting with long enough left.
 * Only then does the aim light it, so a lit hoop never moves off under the
 * coin.
 */
export function hoopReady(hoop: Hoop, t: number, c: CannonConfig): boolean {
  return hoopRestLeft(hoop, t) >= c.chargeS + SHOT_S
}

/** How far a hoop's center travels either side of its `x`: [left, right]. */
export function hoopTravel(hoop: Hoop): [number, number] {
  if (hoop.glide) return [Math.min(0, ...hoop.glide.stops), Math.max(0, ...hoop.glide.stops)]
  const amp = hoop.sweep?.ampX ?? 0
  return [-amp, amp]
}

/**
 * Where the cannon's line at `yaw` passes a hoop centered at `x`, seen from
 * above: the point on it nearest the hoop's center, and how far off center
 * that is. A fired coin flies straight along the line seen from above, so
 * whatever the charge, it can only drop through the hoop if this is under
 * the rim's radius less the coin's.
 */
export function lineByHoop(
  yaw: number,
  hoop: Hoop,
  x: number,
  c: CannonConfig
): { x: number; z: number; off: number } {
  const m = muzzleAt(yaw, c)
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  const dx = x - m.x
  const dz = hoop.z - m.z
  const along = sin * dx - cos * dz
  return { x: m.x + along * sin, z: m.z - along * cos, off: Math.abs(sin * dz + cos * dx) }
}

/** Whether the line at `yaw` lines a coin of `coinRadius` up with a hoop centered at `x`. */
export function linesUp(
  yaw: number,
  hoop: Hoop,
  x: number,
  c: CannonConfig,
  coinRadius: number
): boolean {
  return lineByHoop(yaw, hoop, x, c).off <= hoop.radius - coinRadius
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
