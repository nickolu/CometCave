/**
 * Cabinet geometry and the pure rules that sit on top of it.
 *
 * Units are puck diameters: a round puck is 1 wide and 0.25 thick. That 4:1
 * ratio is the whole stability trick — real coins are ~12:1, and thin bodies
 * tunnel and jitter in a stack. Everything else is sized off the puck.
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
export const PUCK_THICKNESS = 0.25
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

export type Vec3 = [number, number, number]

/** Small deterministic PRNG so the starting pile is the same every load. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SPACING = 1.04

/**
 * The starting pile: stacked columns on the floor in front of the pusher's
 * furthest reach, plus two rows riding the pusher top. Columns, not a nested
 * brick pattern — a round puck laid over the gap between four below rests on
 * four thin edges and slowly slides in, so a brick-stacked pile creeps forever
 * (measured: never sleeps), while columns settle and sleep within 3 seconds.
 * Positions are slightly jittered and raised so nothing starts interpenetrated.
 */
export function seedPile(floorLayers: number, seed = 1): Vec3[] {
  const rand = mulberry32(seed)
  const jitter = () => (rand() - 0.5) * 0.04
  const out: Vec3[] = []
  const cols = [-3, -2, -1, 0, 1, 2, 3].map(c => c * SPACING)

  // Floor, in front of the pusher at its most extended (front face z = -0.5).
  const floorRows = [0.2, 1.24, 2.28, 3.32]
  for (let layer = 0; layer < floorLayers; layer++) {
    const y = PUCK_THICKNESS / 2 + layer * (PUCK_THICKNESS + 0.02) + 0.01
    for (const z of floorRows) {
      for (const x of cols) out.push([x + jitter(), y, z + jitter()])
    }
  }

  // Pusher top, in the strip that stays in front of the back wall at full retraction.
  const topY = PUSHER_HEIGHT + PUCK_THICKNESS / 2 + 0.02
  for (const z of [-4.9, -3.86]) {
    for (const x of cols) out.push([x + jitter(), topY, z + jitter()])
  }

  return out
}
