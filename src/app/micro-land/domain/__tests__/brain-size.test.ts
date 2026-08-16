/**
 * brainSize — cognitive capacity metabolic overhead.
 *
 * Creatures with brainSize > 0 burn extra energy proportional to their
 * cognitive capacity (brainSize × 20% extra hunger rate).
 *
 * Tests:
 *   1. sanitizeBlueprint clamps brainSize to [0, 1] and defaults to 0.
 *   2. A high-brainSize creature accumulates hunger faster than a zero-brainSize one.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

describe('brainSize — sanitizeBlueprint', () => {
  const base = {
    name: 'Thinker',
    tags: ['meat'] as const,
    art: { palette: { a: '#aaaaaa' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 200, faceMotion: false },
    move: { kind: 'walk' as const, speed: 0 },
    diet: { eats: [] as const, hungerRate: 0.1, lifespanSeconds: 900 },
    senses: { sight: 4 },
  }

  it('defaults brainSize to 0 when absent', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).brainSize).toBe(0)
  })

  it('preserves brainSize: 0.8', () => {
    expect(sanitizeBlueprint({ ...base, brainSize: 0.8 }, { summoned: true }).brainSize).toBe(0.8)
  })

  it('clamps brainSize above 1 to 0 (treated as invalid)', () => {
    expect(sanitizeBlueprint({ ...base, brainSize: 1.5 }, { summoned: true }).brainSize).toBe(0)
  })

  it('clamps negative brainSize to 0', () => {
    expect(sanitizeBlueprint({ ...base, brainSize: -0.5 }, { summoned: true }).brainSize).toBe(0)
  })
})

describe('brainSize — simulation', () => {
  function stoneWorld() {
    const w = createWorld(1)
    for (let y = WORLD_H - 4; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.stone
    }
    w.dormant = true
    w.elapsed = 1
    return w
  }

  function creature(brainSize: number): CreatureBlueprint {
    return sanitizeBlueprint(
      {
        name: brainSize > 0 ? `Brain${brainSize}` : 'NoBrain',
        tags: ['meat'],
        art: { palette: { a: '#aaaaaa' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0.1, lifespanSeconds: 900 },
        senses: { sight: 4 },
        brainSize,
      },
      { summoned: true }
    )
  }

  it('high-brainSize creature accumulates hunger faster than zero-brainSize', () => {
    const wHigh = stoneWorld()
    const wZero = stoneWorld()

    const bpHigh = creature(1.0) // brainSize=1 → 20% extra hunger
    const bpZero = creature(0.0)

    registerBlueprint(wHigh, bpHigh)
    registerBlueprint(wZero, bpZero)

    const py = WORLD_H - 7
    spawnCreature(wHigh, bpHigh, 80, py)
    spawnCreature(wZero, bpZero, 80, py)

    wHigh.creatures[0]!.hunger = 0
    wZero.creatures[0]!.hunger = 0

    const rng = makeRng(1)
    // 30 s at 60 Hz = 1800 ticks
    for (let i = 0; i < 1800; i++) {
      tickCreatures(wHigh, 1 / 60, rng, 1, [])
      tickCreatures(wZero, 1 / 60, rng, 1, [])
    }

    const highHunger = wHigh.creatures[0]!.hunger
    const zeroHunger = wZero.creatures[0]!.hunger

    // High-brainSize creature should have accumulated ~20% more hunger
    expect(highHunger).toBeGreaterThan(zeroHunger * 1.1)
  })
})
