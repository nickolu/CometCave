/**
 * Clearing-maintainer herbivores eat plant seedlings even when not hungry,
 * modeling how grazers prevent forest succession by casually browsing seedlings.
 *
 * A "seedling" is a rooted plant younger than SEEDLING_MAX_AGE (30) seconds.
 * When a clearing maintainer is sated, it ignores old plants but still eats
 * young ones. Non-clearing-maintainers leave young plants alone when sated.
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

/** A grazer blueprint. Pass extra fields to enable clearingMaintainer, etc. */
function grazer(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Grazer',
      tags: ['meat'],
      size: 3,
      art: {
        palette: { a: '#88cc44' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: ['plant'], hungerRate: 0, lifespanSeconds: 900, starveSeconds: 60 },
      senses: { sight: 10 },
      ...extra,
    },
    { summoned: true }
  )
}

/** A small rooted plant blueprint. */
function plant(): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Plant',
      tags: ['plant'],
      size: 1,
      art: {
        palette: { g: '#33aa33' },
        frames: [['ggg', 'ggg', 'ggg']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'root', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 1 },
    },
    { summoned: true }
  )
}

/** Run `seconds` of simulation. */
function runSim(w: WorldState, seconds: number): void {
  const rng = makeRng(42)
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

describe('clearing maintainer', () => {
  it('clearing maintainer eats a young plant even when its hunger is below the normal threshold', () => {
    const w = dirtWorld()
    const grazBp = grazer({ clearingMaintainer: true })
    const plantBp = plant()

    registerBlueprint(w, grazBp)
    registerBlueprint(w, plantBp)

    const cx = 40
    const cy = WORLD_H - 16

    // Place grazer with hunger well below the 0.3 threshold — it would not
    // normally eat anything.
    const grazerCreature = spawnCreature(w, grazBp, cx, cy)
    expect(grazerCreature).not.toBeNull()
    grazerCreature!.hunger = 0.1

    // Place the plant directly adjacent (touching) so eating fires immediately.
    const plantCreature = spawnCreature(w, plantBp, cx + 2, cy)
    expect(plantCreature).not.toBeNull()
    // Young seedling — well within SEEDLING_MAX_AGE (30 s).
    plantCreature!.ageSeconds = 5

    const plantId = plantCreature!.id

    runSim(w, 5)

    // The seedling should have been consumed.
    const stillAlive = w.creatures.some(c => c.id === plantId)
    expect(stillAlive).toBe(false)
  })

  it('clearing maintainer does not eat an old plant when sated', () => {
    const w = dirtWorld()
    const grazBp = grazer({ clearingMaintainer: true })
    const plantBp = plant()

    registerBlueprint(w, grazBp)
    registerBlueprint(w, plantBp)

    const cx = 40
    const cy = WORLD_H - 16

    const grazerCreature = spawnCreature(w, grazBp, cx, cy)
    expect(grazerCreature).not.toBeNull()
    grazerCreature!.hunger = 0.1

    // Old plant — beyond SEEDLING_MAX_AGE (30 s).
    const plantCreature = spawnCreature(w, plantBp, cx + 2, cy)
    expect(plantCreature).not.toBeNull()
    plantCreature!.ageSeconds = 60

    const plantId = plantCreature!.id

    runSim(w, 5)

    // Old plant should survive — clearing maintainer only targets seedlings.
    const stillAlive = w.creatures.some(c => c.id === plantId)
    expect(stillAlive).toBe(true)
  })

  it('non-clearing-maintainer herbivore leaves a young plant alone when sated', () => {
    const w = dirtWorld()
    const grazBp = grazer({ clearingMaintainer: false })
    const plantBp = plant()

    registerBlueprint(w, grazBp)
    registerBlueprint(w, plantBp)

    const cx = 40
    const cy = WORLD_H - 16

    const grazerCreature = spawnCreature(w, grazBp, cx, cy)
    expect(grazerCreature).not.toBeNull()
    grazerCreature!.hunger = 0.1

    // Young plant — would be eaten by a clearing maintainer, but not by a
    // regular herbivore that is already sated.
    const plantCreature = spawnCreature(w, plantBp, cx + 2, cy)
    expect(plantCreature).not.toBeNull()
    plantCreature!.ageSeconds = 5

    const plantId = plantCreature!.id

    runSim(w, 5)

    // Plant should survive — ordinary herbivore only eats when hungry.
    const stillAlive = w.creatures.some(c => c.id === plantId)
    expect(stillAlive).toBe(true)
  })
})
