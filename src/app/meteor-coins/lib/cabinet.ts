/**
 * Cabinet geometry and the pure rules that sit on top of it.
 *
 * Units are puck diameters: a round puck is 1 wide and 0.18 thick (~5.5:1).
 * Real coins are ~12:1, and thin bodies tunnel and jitter in a stack. In the
 * headless harness 0.18 and 0.15 piled as still as 0.25 with nothing passing
 * through the table; 0.12 doubled the spin in a resting pile. 0.18 was picked
 * over 0.15 because thinner coins push less per stroke and score lower.
 * Everything else is sized off the puck.
 *
 * Layout, looking down from the player (+z is toward the player):
 *
 *   z = -7    back of the pusher (always hidden behind the back wall)
 *   z = -5.5  back wall face — hangs just above the pusher's top, so pucks
 *             riding the pusher get scraped off as it retracts
 *   z = -2…-0.5  pusher front face, sweeping back and forth
 *   z = 4     front edge — pucks pushed over it fall into the chute or a gutter
 */

export const PUCK_RADIUS = 0.5
export const PUCK_THICKNESS = 0.18
/** Side of a square puck with roughly the same footprint as a round one. */
export const SQUARE_SIDE = 0.9

export type PuckShape = 'round' | 'square'

export const FIELD_HALF_WIDTH = 4
export const FIELD_BACK_Z = -7
export const FIELD_FRONT_Z = 4
export const WALL_HEIGHT = 3

export const PUSHER_DEPTH = 5
export const PUSHER_HEIGHT = 0.6
/** Pusher center z sweeps mid ± amp; front face goes -2 … -0.5. */
export const PUSHER_MID_Z = -3.75
export const PUSHER_AMP_Z = 0.75
export const PUSHER_PERIOD_S = 3.2

export const BACK_WALL_Z = -5.5
/** Gap between pusher top and back wall bottom — smaller than a puck. */
export const BACK_WALL_GAP = 0.05

/** Front edge within this half-width drops into the chute; outside is a gutter. */
export const CHUTE_HALF_WIDTH = 2.6

/** Where dropped pucks enter: above the pusher top, in front of the back wall. */
export const DROP_Y = 3
export const DROP_Z = -3.6
export const AIM_LIMIT = FIELD_HALF_WIDTH - PUCK_RADIUS - 0.1

/** Physics runs at a fixed rate regardless of display refresh. */
export const PHYSICS_STEP_S = 1 / 60
export const GRAVITY = -20

export function pusherCenterZ(timeS: number): number {
  return PUSHER_MID_Z + PUSHER_AMP_Z * Math.sin((2 * Math.PI * timeS) / PUSHER_PERIOD_S)
}

export type FallResult = 'chute' | 'gutter'

export function classifyFall(x: number): FallResult {
  return Math.abs(x) <= CHUTE_HALF_WIDTH ? 'chute' : 'gutter'
}

export function clampAim(x: number): number {
  return Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, x))
}
