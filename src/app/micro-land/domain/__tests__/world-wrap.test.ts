import { describe, expect, it } from 'vitest'

import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { THEMES } from '@/app/micro-land/domain/config/themes'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, setTile, solidAt, tileAt } from '@/app/micro-land/domain/sim/world'

describe('tile access wraps sideways', () => {
  it('reads a column past the right edge as one near the left', () => {
    const w = createWorld(1)
    setTile(w, 5, 10, MATERIAL_INDEX.stone)
    expect(tileAt(w, WORLD_W + 5, 10)).toBe(MATERIAL_INDEX.stone)
    expect(tileAt(w, 5 - WORLD_W, 10)).toBe(MATERIAL_INDEX.stone)
  })

  it('writes through the seam too', () => {
    const w = createWorld(1)
    setTile(w, -1, 10, MATERIAL_INDEX.dirt)
    expect(tileAt(w, WORLD_W - 1, 10)).toBe(MATERIAL_INDEX.dirt)
  })

  /**
   * The old contract was "out of bounds counts as solid, so nothing can wander
   * out of the world". Sideways that wall is exactly what has been removed, and
   * a stray `true` here would read to every walker as a cliff face at column
   * zero that it turns around at forever.
   */
  it('no longer reports a wall at either side', () => {
    const w = createWorld(1)
    expect(solidAt(w, -1, 10)).toBe(false)
    expect(solidAt(w, WORLD_W, 10)).toBe(false)
  })

  it('still reports a wall above and below', () => {
    const w = createWorld(1)
    expect(solidAt(w, 10, -1)).toBe(true)
    expect(solidAt(w, 10, WORLD_H)).toBe(true)
  })
})

/**
 * Terrain has to meet itself at the seam.
 *
 * A world that wraps but whose hills do not is worse than one that does not wrap
 * at all: the cliff at column zero is the single thing that gives the loop away.
 * Every generator samples its noise around a ring for this reason, and the way
 * that silently regresses is someone writing `fbm(noise, x * 0.03, ...)` again
 * because it is the obvious thing to write.
 *
 * Measured against the terrain's own roughness rather than an absolute, because
 * a theme with genuine cliffs in it is allowed a big step — just not a bigger
 * one at the seam than it takes anywhere else.
 */
describe('every theme is continuous across the seam', () => {
  function surfaceRow(tiles: Uint8Array, x: number): number {
    let y = 0
    while (y < WORLD_H && tiles[y * WORLD_W + x] === 0) y++
    return y
  }

  for (const theme of THEMES) {
    it(`${theme.id} has no cliff at column zero`, () => {
      const tiles = new Uint8Array(WORLD_W * WORLD_H)
      theme.build(tiles, makeRng(4242))

      const seamStep = Math.abs(surfaceRow(tiles, WORLD_W - 1) - surfaceRow(tiles, 0))
      let worstStep = 0
      for (let x = 1; x < WORLD_W; x++) {
        const step = Math.abs(surfaceRow(tiles, x) - surfaceRow(tiles, x - 1))
        if (step > worstStep) worstStep = step
      }

      expect(seamStep).toBeLessThanOrEqual(Math.max(3, worstStep))
    })
  }
})
