/**
 * Carnivorous plant — nutrient-poor habitat specialization.
 *
 * Carnivorous plants invert the standard fertility curve: they breed *faster* on
 * nutrient-poor substrates (stone, sand, ash) and slower on rich soil, giving them
 * an ecological niche on barren ground that normal plants cannot exploit.
 *
 * Breed-cooldown formula: normal → fertilityAt; carnivorous → max(0.1, 2−fertilityAt).
 *   sand fertility=0.5  → normal factor 0.5, carnivorous 1.5  → carnivorous 3× faster
 *   mud  fertility=1.3  → normal factor 1.3, carnivorous 0.7  → normal 1.86× faster
 *
 * Tests cover:
 *   1. `sanitizeBlueprint` preserves `carnivorousPlant: true`.
 *   2. On sand, a carnivorous plant produces significantly more offspring than a
 *      normal plant in the same time window.
 *   3. On mud, a carnivorous plant produces fewer offspring than a normal plant
 *      (inverted curve — rich soil is a disadvantage).
 *   4. Non-carnivorous plant is unaffected (carnivorousPlant: false uses standard formula).
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import type { SimEvent } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import { lifespanOf } from '@/app/micro-land/domain/traits'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFloor(matIndex: number): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = matIndex
  }
  w.dormant = true
  // Avoid disease-at-t=0 glitch (same pattern as cryptic-coloration tests).
  w.elapsed = 1
  return w
}

function sandWorld(): WorldState {
  return makeFloor(MATERIAL_INDEX.sand)
}

function mudWorld(): WorldState {
  return makeFloor(MATERIAL_INDEX.mud)
}

/** A rooted plant with long lifespan so it won't die during tests. */
function plantBp(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'TestPlant',
      tags: ['plant'],
      art: {
        palette: { a: '#44aa44' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 400,
        faceMotion: false,
      },
      move: { kind: 'root' },
      diet: { eats: [], hungerRate: 0, breedAt: 0.2, lifespanSeconds: 900 },
      senses: { sight: 0 },
      ...extra,
    },
    { summoned: true }
  )
}

/** Force a creature to adult+ready state so it breeds immediately. */
function makeReady(c: Creature, bp: CreatureBlueprint): Creature {
  c.hunger = 0
  c.ageSeconds = lifespanOf(c, bp) * TUNING.lifespanScale * 0.3
  c.breedCooldown = 0
  return c
}

/**
 * Run `seconds` of simulation and return birth-event count for the given
 * blueprint id. Using birth events rather than creature count isolates breeding
 * from natural death (the parent might die mid-test otherwise).
 */
function countBirths(w: WorldState, bpId: string, seconds: number): number {
  const rng = makeRng(42)
  const events: SimEvent[] = []
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, events)
  return events.filter(e => e.kind === 'born' && e.blueprintId === bpId).length
}

// ---------------------------------------------------------------------------
// 1. Flag preservation
// ---------------------------------------------------------------------------

describe('carnivorousPlant flag', () => {
  it('sanitizeBlueprint preserves carnivorousPlant: true', () => {
    const bp = plantBp({ carnivorousPlant: true })
    expect(bp.carnivorousPlant).toBe(true)
  })

  it('sanitizeBlueprint normalises carnivorousPlant: false', () => {
    const bp = plantBp({ carnivorousPlant: false })
    expect(bp.carnivorousPlant).toBe(false)
  })

  it('sanitizeBlueprint defaults carnivorousPlant to false when absent', () => {
    const bp = plantBp()
    expect(bp.carnivorousPlant).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2–3. Breed-rate inversion on different substrates
//
// On sand (fertility=0.5): carnivorous factor=1.5 vs normal 0.5 → 3× faster.
// On mud  (fertility=1.3): carnivorous factor=0.7 vs normal 1.3 → 1.86× slower.
//
// We run 60 s (3600 ticks) and compare birth counts. The ratio is large enough
// that even with RNG variance the ordering should be unambiguous.
// ---------------------------------------------------------------------------

describe('breed-rate inversion', () => {
  it('carnivorous plant breeds faster on sand (poor soil) than a normal plant', () => {
    const carnivorous = plantBp({ carnivorousPlant: true })
    const normal = plantBp({ name: 'NormalPlant' })

    // Carnivorous plant on sand
    const wC = sandWorld()
    registerBlueprint(wC, carnivorous)
    const cC = spawnCreature(wC, carnivorous, 40, WORLD_H - 15)!
    makeReady(cC, carnivorous)
    const bornCarnivorous = countBirths(wC, carnivorous.id, 60)

    // Normal plant on sand
    const wN = sandWorld()
    registerBlueprint(wN, normal)
    const cN = spawnCreature(wN, normal, 40, WORLD_H - 15)!
    makeReady(cN, normal)
    const bornNormal = countBirths(wN, normal.id, 60)

    // Carnivorous should produce substantially more offspring on poor soil.
    // The formula predicts ~3× ratio; we conservatively require carnivorous > normal.
    expect(bornCarnivorous).toBeGreaterThan(bornNormal)
  })

  it('carnivorous plant breeds slower on mud (rich soil) than a normal plant', () => {
    const carnivorous = plantBp({ carnivorousPlant: true })
    const normal = plantBp({ name: 'NormalPlant' })

    // Carnivorous plant on mud
    const wC = mudWorld()
    registerBlueprint(wC, carnivorous)
    const cC = spawnCreature(wC, carnivorous, 40, WORLD_H - 15)!
    makeReady(cC, carnivorous)
    const bornCarnivorous = countBirths(wC, carnivorous.id, 60)

    // Normal plant on mud
    const wN = mudWorld()
    registerBlueprint(wN, normal)
    const cN = spawnCreature(wN, normal, 40, WORLD_H - 15)!
    makeReady(cN, normal)
    const bornNormal = countBirths(wN, normal.id, 60)

    // On rich mud, normal plant should out-breed the carnivorous one.
    expect(bornNormal).toBeGreaterThan(bornCarnivorous)
  })
})

// ---------------------------------------------------------------------------
// 4. Non-carnivorous plant unaffected
// ---------------------------------------------------------------------------

describe('non-carnivorous plant is unaffected', () => {
  it('plant with carnivorousPlant: false uses standard fertility on sand', () => {
    // carnivorousPlant: false should behave identically to the default.
    const withFlagFalse = plantBp({ carnivorousPlant: false })
    const withoutFlag = plantBp({ name: 'NoFlag' })

    const w1 = sandWorld()
    registerBlueprint(w1, withFlagFalse)
    const c1 = spawnCreature(w1, withFlagFalse, 40, WORLD_H - 15)!
    makeReady(c1, withFlagFalse)
    const born1 = countBirths(w1, withFlagFalse.id, 60)

    const w2 = sandWorld()
    registerBlueprint(w2, withoutFlag)
    const c2 = spawnCreature(w2, withoutFlag, 40, WORLD_H - 15)!
    makeReady(c2, withoutFlag)
    const born2 = countBirths(w2, withoutFlag.id, 60)

    // Both should produce similar birth counts (within ±2 to allow RNG variation).
    expect(Math.abs(born1 - born2)).toBeLessThanOrEqual(2)
  })
})
