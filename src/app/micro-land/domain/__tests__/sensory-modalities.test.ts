/**
 * Sensory modalities — electroreception and infrared vision.
 *
 * Electroreceptive predators detect prey regardless of camouflage.
 * Infrared-vision predators detect warm-blooded prey regardless of camouflage.
 *
 * Tests use the same geometry as cryptic-coloration.test.ts:
 *   predator at x=100, prey at x=143, py = WORLD_H-11
 *   d² = 40² = 1600
 *   With sight=60, hunger=1: foodSight = 180, foodSight² = 32400
 *   detFactor(still, camo=1) = 0.15 → efs² = 32400 × 0.0225 = 729 < 1600 → NOT normally detected
 *   detFactor(still, camo=0) = 0.5  → efs² = 32400 × 0.25  = 8100 > 1600 → detected
 *
 * So: a high-camo prey (e.g. cryptic with matching hue → camo≈1) is normally
 * invisible. But with electroreception or infrared, camo is forced to 0, making
 * the prey detectable.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import {
  createWorld,
  registerBlueprint,
  spawnCreature,
} from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// Blueprint flag tests
// ---------------------------------------------------------------------------

describe('sensory modalities — sanitizeBlueprint', () => {
  const base = {
    name: 'Sensor',
    tags: ['predator'] as const,
    art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
    move: { kind: 'walk' as const, speed: 0 },
    diet: { eats: ['meat'] as const, hungerRate: 0, lifespanSeconds: 900 },
    senses: { sight: 1 },
  }

  it('electroreceptive defaults to false', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).electroreceptive).toBe(false)
  })
  it('electroreceptive: true preserved', () => {
    expect(sanitizeBlueprint({ ...base, electroreceptive: true }, { summoned: true }).electroreceptive).toBe(true)
  })
  it('warmBlooded defaults to false', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).warmBlooded).toBe(false)
  })
  it('warmBlooded: true preserved', () => {
    expect(sanitizeBlueprint({ ...base, name: 'WarmPrey', tags: ['meat'], diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 }, warmBlooded: true }, { summoned: true }).warmBlooded).toBe(true)
  })
  it('infraredVision defaults to false', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).infraredVision).toBe(false)
  })
  it('infraredVision: true preserved', () => {
    expect(sanitizeBlueprint({ ...base, infraredVision: true }, { summoned: true }).infraredVision).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Sim geometry helpers (same as cryptic-coloration.test.ts)
// ---------------------------------------------------------------------------

function dirtWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

/**
 * Run 24 ticks and return true if predator has locked onto the prey.
 */
function checkDetection(predBp: CreatureBlueprint, preyBp: CreatureBlueprint): boolean {
  const w = dirtWorld()
  registerBlueprint(w, predBp)
  registerBlueprint(w, preyBp)

  const py = WORLD_H - 11
  spawnCreature(w, preyBp, 143, py)
  spawnCreature(w, predBp, 100, py)

  const preyC = w.creatures.find(c => c.blueprintId === preyBp.id)!
  const predC = w.creatures.find(c => c.blueprintId === predBp.id)!
  predC.hunger = 1.0

  const rng = makeRng(42)
  for (let i = 0; i < 24; i++) tickCreatures(w, 1 / 60, rng, 1, [])

  return predC.targetId === preyC.id
}

// ---------------------------------------------------------------------------
// Sim tests
// ---------------------------------------------------------------------------

describe('electroreception', () => {
  it('electroreceptive predator detects a high-camo (cryptic) prey that a normal predator cannot', () => {
    // High-camo prey: cryptic with hue ≈ 27° (matching dirt) → camo ≈ 1 → normally invisible
    const highCamoPrey = sanitizeBlueprint(
      {
        name: 'CryptoPrey',
        tags: ['meat'],
        art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        cryptic: true,
        traitDefaults: { hue: 27, camouflage: 0 },
      },
      { summoned: true }
    )

    const normalPred = sanitizeBlueprint(
      {
        name: 'NormalPred',
        tags: ['predator'],
        art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 16 },
        diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
        senses: { sight: 60 },
      },
      { summoned: true }
    )

    const electrPred = sanitizeBlueprint(
      {
        name: 'ElectroPred',
        tags: ['predator'],
        art: { palette: { a: '#0000ff' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 16 },
        diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
        senses: { sight: 60 },
        electroreceptive: true,
      },
      { summoned: true }
    )

    const normalDetects = checkDetection(normalPred, highCamoPrey)
    const electroDetects = checkDetection(electrPred, highCamoPrey)

    expect(normalDetects).toBe(false) // cryptic prey hides from normal predator
    expect(electroDetects).toBe(true) // electroreceptive predator detects bioelectric field
  })
})

describe('infrared vision', () => {
  it('infrared predator detects warm-blooded high-camo prey that a normal predator cannot', () => {
    const warmPrey = sanitizeBlueprint(
      {
        name: 'WarmCryptoPrey',
        tags: ['meat'],
        art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        cryptic: true,
        warmBlooded: true,
        traitDefaults: { hue: 27, camouflage: 0 },
      },
      { summoned: true }
    )

    const normalPred = sanitizeBlueprint(
      {
        name: 'NormalPred2',
        tags: ['predator'],
        art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 16 },
        diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
        senses: { sight: 60 },
      },
      { summoned: true }
    )

    const irPred = sanitizeBlueprint(
      {
        name: 'IRPred',
        tags: ['predator'],
        art: { palette: { a: '#ff8800' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 16 },
        diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
        senses: { sight: 60 },
        infraredVision: true,
      },
      { summoned: true }
    )

    const normalDetects = checkDetection(normalPred, warmPrey)
    const irDetects = checkDetection(irPred, warmPrey)

    expect(normalDetects).toBe(false) // cryptic prey hides from normal predator
    expect(irDetects).toBe(true) // infrared predator detects heat signature
  })

  it('infrared predator does NOT detect cold-blooded high-camo prey', () => {
    // Cold-blooded (warmBlooded: false) cryptic prey — infrared has no advantage
    const coldPrey = sanitizeBlueprint(
      {
        name: 'ColdCryptoPrey',
        tags: ['meat'],
        art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        cryptic: true,
        warmBlooded: false,
        traitDefaults: { hue: 27, camouflage: 0 },
      },
      { summoned: true }
    )

    const irPred = sanitizeBlueprint(
      {
        name: 'IRPred2',
        tags: ['predator'],
        art: { palette: { a: '#ff8800' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 16 },
        diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
        senses: { sight: 60 },
        infraredVision: true,
      },
      { summoned: true }
    )

    const irDetects = checkDetection(irPred, coldPrey)
    expect(irDetects).toBe(false) // infrared cannot detect cold-blooded camouflaged prey
  })
})
