import { GRAVITY, PUCK_THICKNESS, PUSHER_HEIGHT } from '@/app/meteor-coins/lib/cabinet'

/**
 * When a drop lands on clear shelf — the one timing rule every on-table cue
 * is drawn from (Penny Falls' chevrons, Moonstone Porch's landing shadow).
 *
 * The drop line hugs the back wall, which scrapes coins off the pusher's top
 * as it pulls back. So the strip of pusher top just in front of the wall is
 * bare while the pusher is forward in its stroke. Measured headless on the
 * Penny Falls pile (216 drops, binned by where the pusher was at landing):
 * with the pusher in the front 30% of its stroke (sin ≥ 0.6) 95% of coins
 * landed flat on bare shelf; half-way out, half did; further back, almost
 * none. What matters is where the pusher is at *landing*, ~0.65s after the
 * tap, so the cue is judged that far ahead.
 */

export const SHELF_OPEN_SIN = 0.6

/** A released puck starts falling at this speed (see PusherEngine.spawn). */
const RELEASE_SPEED = 1

/** Seconds for a released puck to fall `dy`. */
export function fallTime(dy: number): number {
  const g = -GRAVITY
  return (-RELEASE_SPEED + Math.sqrt(RELEASE_SPEED ** 2 + 2 * g * Math.max(0, dy))) / g
}

/** Seconds from release at `fromY` until a puck reaches the top of a pusher on a floor at `floorY`. */
export function fallTimeToShelf(fromY: number, floorY = 0): number {
  return fallTime(fromY - (floorY + PUSHER_HEIGHT + PUCK_THICKNESS / 2))
}

/** Whether a puck landing on the drop line at `timeS` (physics time) finds bare shelf. */
export function shelfOpenAt(timeS: number, pusherPeriodS: number): boolean {
  return Math.sin((2 * Math.PI * timeS) / pusherPeriodS) >= SHELF_OPEN_SIN
}
