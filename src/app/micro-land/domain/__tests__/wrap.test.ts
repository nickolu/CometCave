import { describe, expect, it } from 'vitest'

import { WORLD_W } from '@/app/micro-land/domain/constants'
import { deltaX, distX, overlapsView, wrapCol, wrapX } from '@/app/micro-land/domain/wrap'

describe('wrapX', () => {
  it('leaves an in-range column alone', () => {
    expect(wrapX(0)).toBe(0)
    expect(wrapX(12.5)).toBe(12.5)
    expect(wrapX(WORLD_W - 1)).toBe(WORLD_W - 1)
  })

  it('brings a column off the right edge back on the left', () => {
    expect(wrapX(WORLD_W)).toBe(0)
    expect(wrapX(WORLD_W + 4)).toBe(4)
  })

  /**
   * The bug this function exists to prevent. `%` keeps the sign of the dividend
   * in JavaScript, so the obvious one-liner returns -1 here — which then indexes
   * the last tile of the row *above*, and nothing looks wrong until something
   * walks left.
   */
  it('brings a column off the left edge back on the right', () => {
    expect(wrapX(-1)).toBe(WORLD_W - 1)
    expect(wrapX(-0.5)).toBe(WORLD_W - 0.5)
    expect(wrapX(-WORLD_W - 3)).toBe(WORLD_W - 3)
  })

  it('always lands in [0, WORLD_W)', () => {
    for (let i = -3 * WORLD_W; i < 3 * WORLD_W; i += 7) {
      const v = wrapX(i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(WORLD_W)
    }
  })
})

describe('wrapCol', () => {
  it('agrees with wrapX on whole columns', () => {
    for (let i = -2 * WORLD_W; i < 2 * WORLD_W; i += 13) {
      expect(wrapCol(i)).toBe(wrapX(i))
    }
  })
})

describe('deltaX', () => {
  it('is plain subtraction away from the seam', () => {
    expect(deltaX(100, 140)).toBe(40)
    expect(deltaX(140, 100)).toBe(-40)
  })

  /**
   * The whole point. Two creatures either side of column zero are neighbours,
   * and the sign has to say "step right", not "walk six hundred tiles left".
   */
  it('takes the short way across the seam', () => {
    expect(deltaX(WORLD_W - 2, 3)).toBe(5)
    expect(deltaX(3, WORLD_W - 2)).toBe(-5)
  })

  it('never reports more than half a world', () => {
    for (let a = 0; a < WORLD_W; a += 31) {
      for (let b = 0; b < WORLD_W; b += 29) {
        expect(Math.abs(deltaX(a, b))).toBeLessThanOrEqual(WORLD_W / 2)
      }
    }
  })

  it('is antisymmetric', () => {
    for (let a = 0; a < WORLD_W; a += 37) {
      for (let b = 0; b < WORLD_W; b += 41) {
        // The exact half-world case is the one point where both directions are
        // equally short, so it is allowed to pick a side and the pair sums to a
        // world rather than to zero.
        const d = deltaX(a, b)
        if (Math.abs(d) === WORLD_W / 2) continue
        // Numeric rather than `toBe`, which is Object.is and so separates -0
        // from 0 — a distinction with no meaning for a distance.
        expect(deltaX(b, a)).toBeCloseTo(-d, 9)
      }
    }
  })

  it('lands you on the target when added to the origin', () => {
    for (let a = 0; a < WORLD_W; a += 53) {
      for (let b = 0; b < WORLD_W; b += 47) {
        expect(wrapX(a + deltaX(a, b))).toBeCloseTo(b, 9)
      }
    }
  })
})

describe('distX', () => {
  it('matches the magnitude of deltaX', () => {
    for (let a = 0; a < WORLD_W; a += 43) {
      for (let b = 0; b < WORLD_W; b += 39) {
        expect(distX(a, b)).toBeCloseTo(Math.abs(deltaX(a, b)), 9)
      }
    }
  })

  it('is symmetric', () => {
    expect(distX(WORLD_W - 2, 3)).toBe(distX(3, WORLD_W - 2))
  })
})

describe('overlapsView', () => {
  const VIEW = 224

  it('accepts something inside the view and rejects something behind it', () => {
    expect(overlapsView(100, 4, 50, VIEW)).toBe(true)
    expect(overlapsView(400, 4, 50, VIEW)).toBe(false)
  })

  it('accepts something straddling the left edge of the view', () => {
    // Two tiles of a four-wide sprite are showing.
    expect(overlapsView(48, 4, 50, VIEW)).toBe(true)
  })

  /**
   * The case the seam adds. A creature sitting on column 670 has its tail in
   * column 2, so a view that starts at column 0 has to draw it even though its
   * left edge is most of a world away to the left.
   */
  it('accepts something whose tail wraps into the start of the view', () => {
    expect(overlapsView(WORLD_W - 2, 8, 0, VIEW)).toBe(true)
  })

  it('accepts something the wrapped view has come round to', () => {
    // View starts near the end of the world and runs past column zero.
    expect(overlapsView(10, 4, WORLD_W - 40, VIEW)).toBe(true)
  })

  it('still rejects the far side of the world from a wrapped view', () => {
    expect(overlapsView(WORLD_W / 2, 4, WORLD_W - 40, VIEW)).toBe(false)
  })

  it('accepts everything when the view is the whole world', () => {
    for (let x = 0; x < WORLD_W; x += 37) {
      expect(overlapsView(x, 1, 300, WORLD_W)).toBe(true)
    }
  })
})
