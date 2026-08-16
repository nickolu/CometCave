import { describe, expect, it } from 'vitest'
import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

function dirtWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

function predBp(polarizedVision: boolean): CreatureBlueprint {
  return sanitizeBlueprint({
    name: polarizedVision ? 'MantisShrimp' : 'NormalPred',
    tags: ['predator'],
    art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
    move: { kind: 'walk', speed: 16 },
    diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
    senses: { sight: 60 },
    polarizedVision,
  }, { summoned: true })
}

function checkDetection(pred: CreatureBlueprint, prey: CreatureBlueprint): boolean {
  const w = dirtWorld()
  registerBlueprint(w, pred)
  registerBlueprint(w, prey)
  const py = WORLD_H - 11
  spawnCreature(w, prey, 143, py)
  spawnCreature(w, pred, 100, py)
  const preyC = w.creatures.find(c => c.blueprintId === prey.id)!
  const predC = w.creatures.find(c => c.blueprintId === pred.id)!
  predC.hunger = 1.0
  const rng = makeRng(42)
  for (let i = 0; i < 24; i++) tickCreatures(w, 1 / 60, rng, 1, [])
  return predC.targetId === preyC.id
}

describe('polarizedVision — sanitizeBlueprint', () => {
  const base = { name: 'T', tags: ['predator'] as const, art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false }, move: { kind: 'walk' as const, speed: 0 }, diet: { eats: ['meat'] as const, hungerRate: 0, lifespanSeconds: 900 }, senses: { sight: 1 } }
  it('defaults to false', () => { expect(sanitizeBlueprint(base, { summoned: true }).polarizedVision).toBe(false) })
  it('preserved when true', () => { expect(sanitizeBlueprint({ ...base, polarizedVision: true }, { summoned: true }).polarizedVision).toBe(true) })
})

describe('polarizedVision — detection', () => {
  it('strips cryptic hue-match bonus — prey detected by polarized predator but not normal', () => {
    const normalPrey = sanitizeBlueprint({
      name: 'CrypticPrey',
      tags: ['meat'],
      art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 1 },
      cryptic: true,
      traitDefaults: { hue: 27, camouflage: 0 }, // matches dirt → camo≈1, traits.camouflage=0
    }, { summoned: true })

    const normalDetects = checkDetection(predBp(false), normalPrey)
    const polarDetects = checkDetection(predBp(true), normalPrey)

    expect(normalDetects).toBe(false) // cryptic hue match hides the prey
    expect(polarDetects).toBe(true)   // polarized vision strips the cryptic bonus
  })

  it('polarized vision does not bypass very high trait camouflage', () => {
    // If traits.camouflage = 0.9, detFactor ≈ 0.1625, efs² ≈ 855 < d²=1600 → still hidden
    const highCamoPrey = sanitizeBlueprint({
      name: 'HighCamoPrey',
      tags: ['meat'],
      art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 1 },
      cryptic: true,
      traitDefaults: { hue: 27, camouflage: 0.9 }, // high innate + cryptic
    }, { summoned: true })

    const polarDetects = checkDetection(predBp(true), highCamoPrey)
    expect(polarDetects).toBe(false) // trait camouflage=0.9 still protects even without cryptic bonus
  })
})
