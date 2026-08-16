/**
 * Root bank stabilization: riparian plants bind loose sand into stable dirt
 * within their root zone, modelling willow/alder erosion prevention.
 *
 * ROOT_STABILIZE_PROB = 0.0005/tick per adjacent tile. With 5 tiles and 60Hz,
 * expected conversions ≈ 5 × 0.0005 × 60 × T per second. At T = 60 s:
 * expected ≈ 9 conversions — near-certainty that at least one converts.
 *
 * P(no conversion in 60 s at one tile) = (1 - 0.0005)^3600 ≈ 0.165.
 * P(no conversion at all, 5 tiles) = 0.165^5 ≈ 0.0001 — safely negligible.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

/** A world with a sand floor for stabilizer plants to reclaim. */
function sandWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.sand
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

/** A root plant blueprint with the given extra options. */
function riparian(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Willow',
      tags: ['plant'],
      art: {
        palette: { a: '#44aa44' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'root' },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 0 },
      ...extra,
    },
    { summoned: true }
  )
}

/** Walker that should NOT stabilize soil. */
function walker(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Walker',
      tags: ['meat'],
      art: {
        palette: { a: '#884422' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 0 },
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

describe('root bank stabilizer', () => {
  it('rootBankStabilizer flag is preserved through sanitizeBlueprint', () => {
    expect(riparian({ rootBankStabilizer: true }).rootBankStabilizer).toBe(true)
    expect(riparian({ rootBankStabilizer: false }).rootBankStabilizer).toBe(false)
    expect(riparian().rootBankStabilizer).toBe(false)
  })

  it('root plant with rootBankStabilizer converts adjacent sand to dirt over 60 s', () => {
    const w = sandWorld()
    const bp = riparian({ rootBankStabilizer: true })
    registerBlueprint(w, bp)

    // Spawn in the sand zone (plants settle onto ground below)
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

  it('root plant without flag leaves sand unchanged', () => {
    const w = sandWorld()
    const bp = riparian() // rootBankStabilizer=false
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

  it('walker with rootBankStabilizer does not stabilize sand (root plants only)', () => {
    // The flag only applies to move.kind==='root' creatures.
    const w = sandWorld()
    const bp = walker({ rootBankStabilizer: true })
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
})
