/**
 * The world is a cylinder: walk off the right edge and you come back on the
 * left. Top and bottom are still walls — a wrapped ceiling in a falling-sand
 * world means powder rains out of the sky forever.
 *
 * Two operations cover every use. `wrapX` puts a column back in range; `deltaX`
 * answers "how far, and which way" between two columns. The second is the one
 * that matters: with no edges, `b - a` is no longer the distance between two
 * points, and every place that subtracted one x from another is now asking a
 * question with two answers. Taking the shorter one is what makes a creature at
 * 670 chase food at 5 by stepping right across the seam instead of walking six
 * hundred tiles the long way round.
 *
 * The invariant that keeps all of this honest: **every stored x is already
 * wrapped**. Creature positions, `homeX`, scent and carcass coordinates all live
 * in `[0, WORLD_W)`. `deltaX` relies on it — it corrects by at most one world
 * width, which is only enough if the raw difference is under 1.5 worlds. Store
 * an unwrapped x anywhere and distances silently go wrong rather than throwing.
 */
import { WORLD_W } from '@/app/micro-land/domain/constants'

/** Half a world. Past this in either direction, the other way round is shorter. */
const HALF_W = WORLD_W / 2

/**
 * Put any x back in `[0, WORLD_W)`.
 *
 * Not just `x % WORLD_W`: JavaScript's `%` keeps the sign of the dividend, so a
 * creature one tile off the left edge comes back as `-1` instead of `WORLD_W - 1`
 * and then indexes the row above it. That is the whole bug, and it is invisible
 * until something walks left.
 */
export function wrapX(x: number): number {
  const m = x % WORLD_W
  return m < 0 ? m + WORLD_W : m
}

/**
 * The same, for integer tile columns, with the in-range case branch-only.
 *
 * Every tile read in the game goes through here — `solidAt` alone is called a
 * few million times a second by `boxHitsSolid` — and the overwhelming majority
 * of them are nowhere near the seam. A compare-and-return costs a fraction of a
 * modulo, and this is the hottest path in the simulation.
 */
export function wrapCol(x: number): number {
  if (x >= 0 && x < WORLD_W) return x
  const m = x % WORLD_W
  return m < 0 ? m + WORLD_W : m
}

/**
 * Signed distance from `from` to `to`, taking the shorter way round.
 *
 * Result is in `(-HALF_W, HALF_W]`, and its *sign is a direction*: positive
 * means "to is to my right", which is what steering reads. Both arguments must
 * already be wrapped (see the module comment) — the single correction below only
 * reaches one world width.
 */
export function deltaX(from: number, to: number): number {
  let d = to - from
  if (d > HALF_W) d -= WORLD_W
  else if (d < -HALF_W) d += WORLD_W
  return d
}

/**
 * Does an object occupying columns `[x, x + width)` overlap the view?
 *
 * The view runs from `viewLeft` for `viewWide` columns and may run off the end
 * of the world, which is what makes this more than a pair of comparisons. Both
 * arguments are on a circle, so "is it to the left of the screen" and "is it to
 * the right of the screen" stop being different questions.
 *
 * Lives here rather than in the renderer because it is the same wrap arithmetic
 * as everything else in this file, and because a private method on a class that
 * needs a canvas to construct is a private method nobody will ever test.
 */
export function overlapsView(
  x: number,
  width: number,
  viewLeft: number,
  viewWide: number
): boolean {
  // Where the object's left edge sits relative to the left of the screen, going
  // right. If that is inside the view the object is on screen.
  const rel = wrapX(x - viewLeft)
  if (rel < viewWide) return true
  // Otherwise it can still be on screen by hanging over the seam: an object
  // starting near the end of the world whose tail reaches back past column zero
  // into the start of the view.
  return rel + width > WORLD_W
}

/**
 * Where column `x` sits on a ring, in noise units.
 *
 * The bridge between a wrapping world and a noise field. Terrain drawn by
 * walking a field from x=0 to x=671 has no reason to arrive back where it
 * started, and what you get is a cliff at column zero — hills on one side, a
 * flat cut on the other, and a player who can see exactly where the trick is.
 * Reading the field around a circle instead fixes it by construction: a circle
 * closes, so a continuous field sampled along one is periodic, with no blending
 * band and no requirement that the lattice divide evenly into the world width.
 *
 * The radius makes the circumference in noise units come to `WORLD_W * freq` —
 * exactly what the old straight-line sampling covered — so features keep the
 * size they have always had. A low frequency gives a small circle and therefore
 * few features across the world, which is what a low frequency always meant.
 *
 * Lives here rather than beside the generators because both the built-in themes
 * and the summoned-terrain painter need it, and they have no other reason to
 * know about each other.
 */
export function ringXY(x: number, freq: number): { u: number; v: number } {
  const r = (WORLD_W * freq) / (2 * Math.PI)
  const t = (x / WORLD_W) * 2 * Math.PI
  return { u: Math.cos(t) * r, v: Math.sin(t) * r }
}

/**
 * Unsigned distance between two columns, the short way.
 *
 * Its own function rather than `Math.abs(deltaX(...))` because most callers only
 * ever want the magnitude, and saying so at the call site is what stops someone
 * later reading a bare `Math.abs` as "direction didn't matter here" when the
 * truth is that it did and got dropped.
 */
export function distX(a: number, b: number): number {
  const d = Math.abs(a - b)
  return d > HALF_W ? WORLD_W - d : d
}
