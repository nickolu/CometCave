/**
 * Competitive exclusion — high competitive ability suppresses co-occurring species.
 *
 * When the sum of competitor `competitiveAbility` values within
 * COMPETITIVE_EXCLUSION_RADIUS exceeds COMPETITIVE_THRESHOLD, the suppressed
 * plant's breed cooldown increases. Invasive species (competitiveAbility=2.0)
 * create more pressure per individual than native species (default 1.0).
 *
 * Tests:
 *   1. competitiveAbility defaults to 1 when absent.
 *   2. A plant surrounded by high-ability competitors breeds slower than
 *      one surrounded by equal-ability competitors.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, SimEvent, WorldState } from '@/app/micro-land/domain/types'

function mudWorld(): WorldState {
  const w = createWorld(5)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.mud
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

function plant(name: string, opts: Record<string, unknown> = {}): CreatureBlueprint {
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

describe('competitive exclusion', () => {
  it('competitiveAbility defaults to 1 when not set', () => {
    const bp = plant('NeutralPlant')
    expect(bp.competitiveAbility).toBe(1)
  })

  it('competitiveAbility is preserved in sanitizeBlueprint', () => {
    const bp = plant('StrongPlant', { competitiveAbility: 2.0 })
    expect(bp.competitiveAbility).toBe(2)
  })

  it('plant surrounded by high-ability competitors breeds slower than one surrounded by equal-ability ones', () => {
    // World A: victim surrounded by 4 high-ability (2.0) competitors
    //   → pressure = 4 × 2.0 / 1.0 = 8 > THRESHOLD=3 → penalty applies
    // World B: victim surrounded by 4 equal-ability (1.0) competitors
    //   → pressure = 4 × 1.0 / 1.0 = 4 > THRESHOLD=3 → smaller penalty
    // So world A victim should have fewer births

    const wHigh = mudWorld()
    const wEqual = mudWorld()

    const victim = plant('Victim')
    const highAbility = plant('HighAbility', { competitiveAbility: 2.0 })
    const equalAbility = plant('EqualAbility', { competitiveAbility: 1.0 })

    registerBlueprint(wHigh, victim)
    registerBlueprint(wHigh, highAbility)
    registerBlueprint(wEqual, victim)
    registerBlueprint(wEqual, equalAbility)

    const py = WORLD_H - 11
    // Victim at x=80, 4 competitors within COMPETITIVE_EXCLUSION_RADIUS=6
    spawnCreature(wHigh, victim, 80, py)
    spawnCreature(wHigh, highAbility, 82, py)
    spawnCreature(wHigh, highAbility, 83, py)
    spawnCreature(wHigh, highAbility, 84, py)
    spawnCreature(wHigh, highAbility, 85, py)

    spawnCreature(wEqual, victim, 80, py)
    spawnCreature(wEqual, equalAbility, 82, py)
    spawnCreature(wEqual, equalAbility, 83, py)
    spawnCreature(wEqual, equalAbility, 84, py)
    spawnCreature(wEqual, equalAbility, 85, py)

    for (const c of wHigh.creatures) c.breedCooldown = 0
    for (const c of wEqual.creatures) c.breedCooldown = 0

    const rng = makeRng(42)
    const eventsHigh: SimEvent[] = []
    const eventsEqual: SimEvent[] = []

    for (let i = 0; i < 10800; i++) {
      tickCreatures(wHigh, 1 / 60, rng, 1, eventsHigh)
      tickCreatures(wEqual, 1 / 60, rng, 1, eventsEqual)
    }

    const highBirths = eventsHigh.filter(e => e.kind === 'born' && e.blueprintId === victim.id).length
    const equalBirths = eventsEqual.filter(e => e.kind === 'born' && e.blueprintId === victim.id).length

    expect(equalBirths).toBeGreaterThan(highBirths)
  }, 30000)
})
