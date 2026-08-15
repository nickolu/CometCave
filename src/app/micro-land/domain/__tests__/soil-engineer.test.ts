/**
 * Soil-engineering species convert dirt to mud as they move through it.
 *
 * The effect is probabilistic (SOIL_ENRICH_PROB per tick), so tests run enough
 * ticks for the probability to become a near-certainty, then check the outcome.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

/** A world filled with dirt at the bottom for creatures to stand on. */
function dirtWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  return w
}

/** A world filled with mud at the bottom. */
function mudWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.mud
  }
  w.dormant = true
  return w
}

/** A stationary walker with the given extra options. */
function worm(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Worm',
      tags: ['meat'],
      art: {
        palette: { a: '#cc8844' },
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

/** Run `seconds` of simulation and return the world unchanged. */
function runSim(w: WorldState, seconds: number): void {
  const rng = makeRng(42)
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

describe('soil engineering', () => {
  it('soil engineer sitting on a dirt tile converts it to mud over many ticks', () => {
    const w = dirtWorld()
    const bp = worm({ soilEngineer: true })
    registerBlueprint(w, bp)

    // Place the creature in the dirt zone.
    spawnCreature(w, bp, 40, WORLD_H - 16)

    // Run long enough that the probabilistic conversion is near-certain.
    // At SOIL_ENRICH_PROB=0.002 per tick and 60 Hz: P(no conversion after N ticks)
    // = (1 - 0.002)^N. At 30 s (1800 ticks) that is ~0.027 — safely negligible.
    runSim(w, 30)

    // At least one tile in the dirt zone should have become mud.
    let foundMud = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.mud) {
          foundMud = true
        }
      }
    }
    expect(foundMud).toBe(true)
  })

  it('non-engineer creature on dirt leaves the tile unchanged', () => {
    const w = dirtWorld()
    const bp = worm() // no soilEngineer
    registerBlueprint(w, bp)

    const cx = 40
    const cy = WORLD_H - 16
    spawnCreature(w, bp, cx, cy)

    runSim(w, 30)

    // Every tile in the dirt zone should still be dirt.
    let foundMud = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.mud) {
          foundMud = true
        }
      }
    }
    expect(foundMud).toBe(false)
  })

  it('soil engineer on mud has no effect', () => {
    const w = mudWorld()
    const bp = worm({ soilEngineer: true })
    registerBlueprint(w, bp)

    const cx = 40
    const cy = WORLD_H - 16
    spawnCreature(w, bp, cx, cy)

    runSim(w, 30)

    // All tiles should remain mud — no conversion from mud to something else.
    let allMud = true
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] !== MATERIAL_INDEX.mud) {
          allMud = false
        }
      }
    }
    expect(allMud).toBe(true)
  })
})
