/**
 * Biotic resistance — diverse native communities slow invasive colonization.
 *
 * An invasive plant surrounded by >= BIOTIC_RESISTANCE_THRESHOLD = 3 distinct
 * native species gets breedCooldown × 1.5. In a native-species-poor area it
 * breeds at normal speed.
 *
 * Tests:
 *   1. Invasive plant in diverse native community (3+ species) breeds slower
 *      than the same invasive alone (no native species nearby).
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import type { SimEvent } from '@/app/micro-land/domain/sim/creature-sim'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

function mudWorld(): WorldState {
  const w = createWorld(17)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.mud
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

function makePlant(name: string, opts: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name,
      tags: ['plant'],
      art: { palette: { a: '#228b22' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'root', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900, breedAt: 0.0 },
      senses: { sight: 1 },
      ...opts,
    },
    { summoned: true }
  )
}

describe('biotic resistance', () => {
  it('invasive plant breeds slower in a diverse native community than in an empty area', { timeout: 30000 }, () => {
    const wDiverse = mudWorld()   // invasive + 3 native species nearby
    const wEmpty = mudWorld()     // invasive alone (no natives)

    const invasive = makePlant('Invader', { invasive: true })
    registerBlueprint(wDiverse, invasive)
    registerBlueprint(wEmpty, invasive)

    // Add 3 distinct native species to the diverse world
    const native1 = makePlant('Native1')
    const native2 = makePlant('Native2')
    const native3 = makePlant('Native3')
    registerBlueprint(wDiverse, native1)
    registerBlueprint(wDiverse, native2)
    registerBlueprint(wDiverse, native3)

    const py = WORLD_H - 11
    // Invasive at x=80 in both worlds
    spawnCreature(wDiverse, invasive, 80, py)
    spawnCreature(wEmpty, invasive, 80, py)

    // Place 3 native plants within BIOTIC_RESISTANCE_RADIUS=12 in the diverse world
    // Use x=83, 87, 91 — all within 12 tiles of x=80
    spawnCreature(wDiverse, native1, 83, py)
    spawnCreature(wDiverse, native2, 87, py)
    spawnCreature(wDiverse, native3, 91, py)

    // Force immediate breeding start
    for (const c of wDiverse.creatures) c.breedCooldown = 0
    for (const c of wEmpty.creatures) c.breedCooldown = 0

    const rng = makeRng(42)
    const eventsDiverse: SimEvent[] = []
    const eventsEmpty: SimEvent[] = []

    // 180 s at 60 Hz
    for (let i = 0; i < 10800; i++) {
      tickCreatures(wDiverse, 1 / 60, rng, 1, eventsDiverse)
      tickCreatures(wEmpty, 1 / 60, rng, 1, eventsEmpty)
    }

    const diverseBirths = eventsDiverse.filter(e => e.kind === 'born' && e.blueprintId === invasive.id).length
    const emptyBirths = eventsEmpty.filter(e => e.kind === 'born' && e.blueprintId === invasive.id).length

    // The invasive in the diverse community should have had fewer births
    expect(emptyBirths).toBeGreaterThan(diverseBirths)
  })
})
