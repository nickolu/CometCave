/**
 * Slow metabolism — extreme K-strategist survival adaptation.
 *
 * Creatures with slowMetabolism: true burn energy at 10% of normal rate
 * (metabolicRate multiplier = 0.1). This lets cave-adapted species survive
 * in nutrient-scarce environments.
 *
 * Tests cover:
 *   1. sanitizeBlueprint preserves slowMetabolism: true/false/absent.
 *   2. A slow-metabolism creature starves much more slowly than a normal one.
 *   3. A slow-metabolism creature is not yet dead after N seconds where the
 *      normal creature has starved.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// 1. Blueprint flag tests
// ---------------------------------------------------------------------------

describe('slowMetabolism — sanitizeBlueprint', () => {
  const base = {
    name: 'CaveOlm',
    tags: ['meat'] as const,
    art: {
      palette: { a: '#ffffff' },
      frames: [['aaa', 'aaa', 'aaa']],
      frameMs: 200,
      faceMotion: false,
    },
    move: { kind: 'walk' as const, speed: 0 },
    diet: { eats: [] as const, hungerRate: 0.02, lifespanSeconds: 900 },
    senses: { sight: 4 },
  }

  it('preserves slowMetabolism: true', () => {
    const bp = sanitizeBlueprint({ ...base, slowMetabolism: true }, { summoned: true })
    expect(bp.slowMetabolism).toBe(true)
  })

  it('preserves slowMetabolism: false', () => {
    const bp = sanitizeBlueprint({ ...base, slowMetabolism: false }, { summoned: true })
    expect(bp.slowMetabolism).toBe(false)
  })

  it('defaults slowMetabolism to false when absent', () => {
    const bp = sanitizeBlueprint(base, { summoned: true })
    expect(bp.slowMetabolism).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2–3. Simulation tests
// ---------------------------------------------------------------------------

/** A stone world so creatures can stand on something. */
function stoneWorld() {
  const w = createWorld(42)
  for (let y = WORLD_H - 4; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.stone
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

function creatureBp(slowMetabolism: boolean): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: slowMetabolism ? 'CaveOlm' : 'Surface',
      tags: ['meat'],
      art: {
        palette: { a: '#cccccc' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      // Effective hunger rate = hungerRate × HUNGER_RATE_SCALE (0.1)
      // hungerRate=0.2 → effective 0.02/s → normal creature hits hunger=1 in ~50s
      // slow-metabolism applies ×0.1 → effective 0.002/s → hits hunger=1 in ~500s
      diet: { eats: [], hungerRate: 0.2, starveSeconds: 3, lifespanSeconds: 900 },
      senses: { sight: 1 },
      slowMetabolism,
    },
    { summoned: true }
  )
}

describe('slowMetabolism — simulation', () => {
  it('slow-metabolism creature accumulates hunger 10× slower than normal', () => {
    const wNormal = stoneWorld()
    const wSlow = stoneWorld()

    const bpNormal = creatureBp(false)
    const bpSlow = creatureBp(true)

    registerBlueprint(wNormal, bpNormal)
    registerBlueprint(wSlow, bpSlow)

    const py = WORLD_H - 7
    spawnCreature(wNormal, bpNormal, 80, py)
    spawnCreature(wSlow, bpSlow, 80, py)

    const cNormal = wNormal.creatures[0]!
    const cSlow = wSlow.creatures[0]!

    // Both start fully fed
    cNormal.hunger = 0
    cSlow.hunger = 0

    const rng = makeRng(1)
    // Run 30 s (1800 ticks at 60 Hz)
    for (let i = 0; i < 1800; i++) {
      tickCreatures(wNormal, 1 / 60, rng, 1, [])
      tickCreatures(wSlow, 1 / 60, rng, 1, [])
    }

    // Normal creature should be quite hungry after 30 s (hungerRate=0.02 × 30=0.6)
    expect(cNormal.hunger).toBeGreaterThan(0.4)

    // Slow-metabolism creature should be ~10× less hungry
    expect(cSlow.hunger).toBeLessThan(cNormal.hunger / 5)
  })

  it('normal creature starves but slow-metabolism creature survives the same period', { timeout: 15000 }, () => {
    // Run 65 s. The normal creature reaches hunger=1 (around ~50-60 s depending
    // on rest cycles) and, with starveSeconds=3, dies before 65 s. The
    // slow-metabolism creature (×0.1 rate) won't reach hunger=1 in this window.
    const wNormal = stoneWorld()
    const wSlow = stoneWorld()

    const bpNormal = creatureBp(false)
    const bpSlow = creatureBp(true)

    registerBlueprint(wNormal, bpNormal)
    registerBlueprint(wSlow, bpSlow)

    const py = WORLD_H - 7
    spawnCreature(wNormal, bpNormal, 80, py)
    spawnCreature(wSlow, bpSlow, 80, py)

    wNormal.creatures[0]!.hunger = 0
    wSlow.creatures[0]!.hunger = 0

    const rng = makeRng(1)
    // 65 s × 60 ticks/s = 3900 ticks
    for (let i = 0; i < 3900; i++) {
      tickCreatures(wNormal, 1 / 60, rng, 1, [])
      tickCreatures(wSlow, 1 / 60, rng, 1, [])
    }

    // Normal creature should have starved (removed from world)
    const normalAlive = wNormal.creatures.find(c => c.blueprintId === bpNormal.id)
    expect(normalAlive).toBeUndefined()

    // Slow-metabolism creature should still be alive
    const slowAlive = wSlow.creatures.find(c => c.blueprintId === bpSlow.id)
    expect(slowAlive).toBeDefined()
  })
})
