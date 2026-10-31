import { FIELD_HALF_WIDTH, PUCK_RADIUS } from '@/app/meteor-coins/lib/cabinet'

/**
 * A pachinko board: two glass panes standing over the drop line, a coin's
 * thickness apart, with pins across the slot between them. Coins drop in on
 * edge from the arm, bounce down through the pins like wheels and leave the
 * bottom of the board onto the pusher. Cups among the pins catch a coin and
 * pour bonus coins.
 *
 * On edge, because flat coins don't work: in a deep board they came to rest
 * balanced on pins (6–14 of 60 stuck) and took ~2s to fall.
 */
export type Cup = { x: number; y: number; width: number; bonus: number }

export type Board = {
  /** Where each pin crosses the board: across, and up. */
  pins: readonly { x: number; y: number }[]
  pinRadius: number
  /** The slot between the panes: its middle (the drop line), and its width. */
  z: number
  slot: number
  /** The glass runs from here up to `topY`; below it coins leave the board. */
  bottomY: number
  topY: number
  cups: readonly Cup[]
  /**
   * Upright plates across the bottom of the board, from `bottomY` up to
   * `dividerTop`, at these x: bins, as on a Plinko board. A coin leaves
   * the board falling, not flying sideways off the pins (without them,
   * coins came off at up to 4/s sideways and rolled into the gutters).
   */
  dividers: readonly number[]
  dividerTop: number
  /**
   * A gate across the bottom of the bins, timed to the pusher: coins wait in
   * the bins and drop together when the shelf below is bare. A coin's trip
   * through the pins takes a few unpredictable seconds, so without it every
   * coin landed at a random moment of the stroke (9 points against 29 with
   * no board at all).
   */
  gated: boolean
  /**
   * Pins that sweep side to side, at height `y`, by `ampX`, every
   * `periodS`. A fixed board has sweet spots: a coin dropped over the cup
   * bounced back to the middle and in every time. One sweeping across the
   * cup's mouth makes the catch a matter of timing as well as aim. Not a
   * solid: it bounces coins that fall onto it (see sweeperKnock).
   */
  sweepers: readonly { y: number; ampX: number; periodS: number }[]
}

/** Where a sweeping pin is across the board at physics time `t`. */
export function sweeperX(s: { ampX: number; periodS: number }, t: number): number {
  return s.ampX * Math.sin((2 * Math.PI * t) / s.periodS)
}

/** How fast a sweeping pin is moving across the board at physics time `t`. */
export function sweeperVX(s: { ampX: number; periodS: number }, t: number): number {
  const w = (2 * Math.PI) / s.periodS
  return s.ampX * w * Math.cos(w * t)
}

/** A sweeping pin is fatter than a fixed one, to carry the big star. */
export const SWEEPER_SCALE = 1.5
const SWEEPER_BOUNCE = 0.3

/**
 * How a sweeping pin knocks a coin it touches: the coin's new velocity in
 * the board's plane, or null where it doesn't touch or is already moving
 * away. A bounce, as off a solid pin, but only ever a change of velocity.
 * As a solid kinematic body the star moved whatever was in its way at any
 * cost: a coin resting on a cup wall or against a pin was crushed into the
 * glass and stuck there (5 coins in 300 drops), and with a stuck coin on
 * the board no coin can be dropped. Velocity alone can't crush anything:
 * a coin with nowhere to go lets the star pass over it (the star is drawn
 * on the front pane, so it passes in front of the coin).
 */
export function sweeperKnock(
  s: { y: number; ampX: number; periodS: number },
  pinRadius: number,
  t: number,
  at: { x: number; y: number },
  v: { x: number; y: number }
): { x: number; y: number } | null {
  const dx = at.x - sweeperX(s, t)
  const dy = at.y - s.y
  const d = Math.hypot(dx, dy)
  if (d >= PUCK_RADIUS + pinRadius * SWEEPER_SCALE || d < 1e-6) return null
  const nx = dx / d
  const ny = dy / d
  // Only a coin coming down onto the star bounces off it. The star never
  // pushes a coin that isn't moving into it, or one level with or below it:
  // a coin resting on the cup's walls sits at the star's height, and a star
  // that pushed it got it shuttled back and forth over the cup's mouth,
  // never left to drop in (8 coins in 800 drops; still 11 in 1,600 with
  // the star pushing only coins moving into it).
  if (ny <= 0 || v.x * nx + v.y * ny >= 0) return null
  // The bounce is off the moving star, so its motion carries into the coin.
  const closing = (v.x - sweeperVX(s, t)) * nx + v.y * ny
  if (closing >= 0) return null
  const k = (1 + SWEEPER_BOUNCE) * closing
  return { x: v.x - k * nx, y: v.y - k * ny }
}

/** How far the gate slides back, into the wall, to open. */
export const GATE_TRAVEL = 1.2

/** Each cup's walls stand this high above its floor. */
export const CUP_WALL = 0.45
export const CUP_FLOOR = 0.08

/**
 * Whether a coin at (x, y) has landed in a cup: inside its walls, with its
 * center no higher than an upright coin standing on the cup's floor.
 */
export function inCup(cup: Cup, x: number, y: number): boolean {
  return (
    Math.abs(x - cup.x) < cup.width / 2 && y > cup.y && y < cup.y + CUP_FLOOR + PUCK_RADIUS + 0.1
  )
}

/**
 * Pins in staggered rows, `rows` high from `fromY` up, `gap` apart, filling
 * the width: each row also has a pin hard against each wall, too close to
 * it for a coin to slip between, which turns coins in the outer lanes back
 * in. Every other gap a coin could fall into — between pins in a row,
 * between rows — has to be wider than a coin, or a coin wedges there: rows
 * 0.8 apart left the diagonal gap at 0.93 and coins stuck in it.
 */
export function staggeredPins(
  rows: number,
  fromY: number,
  rowGap: number,
  gap: number,
  maxX: number
): { x: number; y: number }[] {
  const pins: { x: number; y: number }[] = []
  const wallPin = FIELD_HALF_WIDTH - WALL_PIN_INSET
  for (let r = 0; r < rows; r++) {
    const y = fromY + r * rowGap
    const offset = r % 2 ? gap / 2 : 0
    for (let k = -10; k <= 10; k++) {
      const x = k * gap + offset
      if (Math.abs(x) <= maxX) pins.push({ x, y })
    }
    pins.push({ x: -wallPin, y }, { x: wallPin, y })
  }
  return pins
}

/** How far a wall pin's center stands off the wall. */
export const WALL_PIN_INSET = 0.15
