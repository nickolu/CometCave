/**
 * Bioturbation: digging creatures convert infertile tiles (sand, stone, ash, bone)
 * to dirt as they walk over them, reclaiming barren areas.
 *
 * The effect is probabilistic (BIOTURBATION_PROB=0.001 per tick). Tests run enough
 * ticks for the probability to become near-certain, then check the outcome.
 *
 * BIOTURBATION_PROB=0.001 per tick at 60Hz → ~6% per second.
 * At 60 s (3600 ticks): P(no conversion) = (1 - 0.001)^3600 ≈ 0.027.
 * Using 60 s gives confidence comparable to the soil-engineer 30 s test
 * (which uses SOIL_ENRICH_PROB=0.002, twice as high).
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

/** A world with an infertile sand floor for bioturbators to reclaim. */
function sandWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.sand
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

/** A world with a stone floor. */
function stoneWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.stone
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

/** A walker blueprint with the given extra options. */
function digger(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Digger',
      tags: ['meat'],
      art: {
        palette: { a: '#886644' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 4 },
      ...extra,
    },
    { summoned: true }
  )
}

/** Run `seconds` of simulation. */
function runSim(w: WorldState, seconds: number): void {
  const rng = makeRng(42)
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

describe('bioturbation', () => {
  it('bioturbator flag is preserved through sanitizeBlueprint', () => {
    expect(digger({ bioturbator: true }).bioturbator).toBe(true)
    expect(digger({ bioturbator: false }).bioturbator).toBe(false)
    expect(digger().bioturbator).toBe(false)
  })

  it('bioturbator on sand converts at least one tile to dirt over 60 s', () => {
    const w = sandWorld()
    const bp = digger({ bioturbator: true })
    registerBlueprint(w, bp)

    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 60)

    let foundDirt = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.dirt) {
          foundDirt = true
        }
      }
    }
    expect(foundDirt).toBe(true)
  })

  it('non-bioturbator on sand leaves the tile unchanged', () => {
    const w = sandWorld()
    const bp = digger() // bioturbator=false
    registerBlueprint(w, bp)

    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 60)

    let foundDirt = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.dirt) {
          foundDirt = true
        }
      }
    }
    expect(foundDirt).toBe(false)
  })

  it('bioturbator on stone converts to dirt', () => {
    const w = stoneWorld()
    const bp = digger({ bioturbator: true })
    registerBlueprint(w, bp)

    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 60)

    let foundDirt = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.dirt) {
          foundDirt = true
        }
      }
    }
    expect(foundDirt).toBe(true)
  })

  it('bioturbator does not convert dirt tiles (only infertile substrates)', () => {
    // Bioturbation is not soil engineering — it should not change dirt to anything.
    const w = createWorld(1234)
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
    }
    w.dormant = true
    w.elapsed = 1

    const bp = digger({ bioturbator: true })
    registerBlueprint(w, bp)
    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 30)

    // All floor tiles should still be dirt (not mud or any other change).
    let allDirt = true
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] !== MATERIAL_INDEX.dirt) {
          allDirt = false
        }
      }
    }
    expect(allDirt).toBe(true)
  })
})
