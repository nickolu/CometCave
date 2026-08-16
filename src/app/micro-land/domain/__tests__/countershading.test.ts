/**
 * Countershading: dark dorsal / pale ventral coloration that cancels shadow
 * depth cues, giving a fixed +0.25 camouflage bonus regardless of tile or hue.
 *
 * Unlike cryptic coloration (tile-dependent) or the camouflage trait (heritable),
 * countershading is a structural bonus that is constant across all tiles and
 * persists even when the population is not under selection.
 *
 * Detection geometry (sight=60, hunger=1, roamOf=1, desperation=1):
 *   foodSight = 60 * (1 + HUNGER_REACH * 1 * 1) = 60 * 3 = 180
 *   still plain (camo=0):        detFactor = 0.5,   efs = 90,  efs² = 8100
 *   still countershaded (camo=0.25): detFactor = max(0.15, 0.5-0.25×0.375) = 0.406, efs = 73, efs² = 5329
 *
 *   Gap of 82: d² = 6724.
 *     plain: 6724 < 8100 → detected ✓
 *     countershaded: 6724 > 5329 → NOT detected ✓
 *
 *   Predator at x=100, prey at x=185 → gapX = |185-100| - (3+3)/2 = 85-3 = 82. ✓
 *   Both at py=WORLD_H-11 so gapY=0.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

function groundWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  w.elapsed = 1 // avoid disease-outbreak edge case at elapsed=0
  return w
}

function pred(): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Pred',
      tags: ['predator'],
      art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
      senses: { sight: 60 },
    },
    { summoned: true }
  )
}

function prey(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Prey',
      tags: ['meat'],
      art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 }, // stationary → "still" detFactor applies
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 0 },
      traitDefaults: { camouflage: 0 }, // pin to camo=0 so the geometry in the comment is exact
      ...extra,
    },
    { summoned: true }
  )
}

function runSensePasses(w: WorldState, n: number): void {
  const rng = makeRng(42)
  for (let i = 0; i < n * 6; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

describe('countershading', () => {
  it('countershaded flag is preserved through sanitizeBlueprint', () => {
    expect(prey({ countershaded: true }).countershaded).toBe(true)
    expect(prey({ countershaded: false }).countershaded).toBe(false)
    expect(prey().countershaded).toBe(false)
  })

  it('plain still prey at gap=82 is detected (efs=90 > 82)', () => {
    const w = groundWorld()
    const predBp = pred()
    const preyBp = prey({ countershaded: false })
    registerBlueprint(w, predBp)
    registerBlueprint(w, preyBp)

    const py = WORLD_H - 11
    spawnCreature(w, predBp, 100, py)
    spawnCreature(w, preyBp, 185, py) // gapX = 185-100-3 = 82

    const predC = w.creatures.find(c => c.blueprintId === predBp.id)!
    const preyC = w.creatures.find(c => c.blueprintId === preyBp.id)!
    predC.hunger = 1.0

    runSensePasses(w, 4)

    expect(predC.targetId).toBe(preyC.id)
  })

  it('countershaded still prey at gap=82 evades detection (efs=73 < 82)', () => {
    const w = groundWorld()
    const predBp = pred()
    const preyBp = prey({ countershaded: true })
    registerBlueprint(w, predBp)
    registerBlueprint(w, preyBp)

    const py = WORLD_H - 11
    spawnCreature(w, predBp, 100, py)
    spawnCreature(w, preyBp, 185, py) // same gap = 82

    const predC = w.creatures.find(c => c.blueprintId === predBp.id)!
    predC.hunger = 1.0

    runSensePasses(w, 4)

    expect(predC.targetId).toBeNull()
  })
})
