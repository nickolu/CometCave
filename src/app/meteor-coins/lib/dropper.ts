import { BACK_WALL_Z, DROP_Z, FIELD_HALF_WIDTH, PUCK_RADIUS } from '@/app/meteor-coins/lib/cabinet'

/**
 * The swinging arm and the moving skill-shot ring.
 *
 * The player never steers anything. The arm swings like a pendulum from a
 * pivot above the table; a tap releases a puck straight down from its tip.
 * A ring slides left and right below the arm at a different period, so good
 * lineups come and go — the skill is reading the rhythm and leading the ring,
 * since it keeps moving while the puck falls.
 *
 * Both run on "dropper time", which advances with physics time times a speed
 * factor, so the slower-arm option slows the timing without slowing gravity.
 */

export const ARM_PIVOT_Y = 12.5
export const ARM_LENGTH = 7
/** Tip reaches x = ±3.2, just inside the side walls. */
export const ARM_MAX_ANGLE = Math.asin(3.2 / ARM_LENGTH)
export const ARM_PERIOD_S = 2.6

/**
 * Well above the pusher top (0.6): coins pile up there, and lower rings (2,
 * then 3.2) got covered by that pile mid-game.
 */
export const RING_Y = 4
export const RING_RANGE = 2.4
export const RING_PERIOD_S = 3.9
/** Starts the ring away from the arm so the first lineup isn't at t = 0. */
const RING_PHASE = 1.1
/** Inner radius of the drawn ring, and the thickness of its rim. */
export const RING_RADIUS = 0.8
export const RING_TUBE = 0.09
/**
 * A hit means the puck fits through the ring without touching the rim — what
 * the player sees is what counts. (A looser rule let pucks visibly overlapping
 * the rim count, and a well-timed bot hit 49 of 50.) Objects wider than a
 * coin pass `reach`, their farthest point from center.
 */
export const HIT_RADIUS = RING_RADIUS - PUCK_RADIUS

export const SLOW_SPEED = 0.6

export function armAngle(t: number, periodS = ARM_PERIOD_S): number {
  return ARM_MAX_ANGLE * Math.sin((2 * Math.PI * t) / periodS)
}

/** Where a released puck starts: the arm tip, in front of the back wall. */
export function armTip(t: number, periodS = ARM_PERIOD_S): { x: number; y: number; z: number } {
  const a = armAngle(t, periodS)
  return { x: ARM_LENGTH * Math.sin(a), y: ARM_PIVOT_Y - ARM_LENGTH * Math.cos(a), z: DROP_Z }
}

export function ringX(t: number): number {
  return RING_RANGE * Math.sin((2 * Math.PI * t) / RING_PERIOD_S + RING_PHASE)
}

export function isHit(puckX: number, t: number, reach = PUCK_RADIUS): boolean {
  return Math.abs(puckX - ringX(t)) <= RING_RADIUS - reach
}

// Guard: the ring hangs on the drop line, which hugs the back wall.
if (DROP_Z - RING_RADIUS - RING_TUBE <= BACK_WALL_Z) {
  throw new Error('Skill-shot ring would clip the back wall')
}

// Guard: the arm must never drop a puck outside the walls.
if (ARM_LENGTH * Math.sin(ARM_MAX_ANGLE) > FIELD_HALF_WIDTH - PUCK_RADIUS) {
  throw new Error('Arm swing reaches past the side walls')
}
