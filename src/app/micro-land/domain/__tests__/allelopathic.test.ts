/**
 * Allelopathic plants — novel weapon advantage.
 *
 * An allelopathic plant suppresses the breeding rate of nearby non-resistant
 * plants (breedCooldown × 1.3). Plants with novelCompoundResistant: true
 * are immune.
 *
 * Tests:
 *   1. sanitizeBlueprint preserves allelopathic and novelCompoundResistant.
 *   2. A plant next to an allelopathic competitor produces fewer births than
 *      one next to a non-allelopathic competitor of equal size.
 *   3. A novelCompoundResistant plant is unaffected by an allelopathic neighbor.
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

// ---------------------------------------------------------------------------
// 1. Blueprint tests
// ---------------------------------------------------------------------------

describe('allelopathic — sanitizeBlueprint', () => {
  const base = {
    name: 'TestPlant',
    tags: ['plant'] as const,
    art: { palette: { a: '#00ff00' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 200, faceMotion: false },
    move: { kind: 'root' as const, speed: 0 },
    diet: { eats: [] as const, hungerRate: 0, lifespanSeconds: 900 },
    senses: { sight: 4 },
  }

  it('preserves allelopathic: true', () => {
    expect(sanitizeBlueprint({ ...base, allelopathic: true }, { summoned: true }).allelopathic).toBe(true)
  })

  it('defaults allelopathic to false', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).allelopathic).toBe(false)
  })

  it('preserves novelCompoundResistant: true', () => {
    expect(sanitizeBlueprint({ ...base, novelCompoundResistant: true }, { summoned: true }).novelCompoundResistant).toBe(true)
  })

  it('defaults novelCompoundResistant to false', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).novelCompoundResistant).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Sim helpers
// ---------------------------------------------------------------------------

function mudWorld(): WorldState {
  const w = createWorld(55)
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
      traitDefaults: { fertility: 1.0 },
      ...opts,
    },
    { summoned: true }
  )
}

function countBirths(blueprintId: string, events: SimEvent[]): number {
  return events.filter(e => e.kind === 'born' && e.blueprintId === blueprintId).length
}

// ---------------------------------------------------------------------------
// 2. Allelopathic suppression test
// ---------------------------------------------------------------------------

describe('allelopathic — suppression', () => {
  it('plant next to allelopathic competitor breeds slower than next to non-allelopathic', { timeout: 30000 }, () => {
    const wSuppressed = mudWorld()
    const wFree = mudWorld()

    // The victim plant (same species in both worlds)
    const victim = makePlant('Victim')

    // The competitor — allelopathic in one world, not in the other
    const allelopathicComp = makePlant('Allelopathic', { allelopathic: true })
    const normalComp = makePlant('Normal')

    registerBlueprint(wSuppressed, victim)
    registerBlueprint(wSuppressed, allelopathicComp)
    registerBlueprint(wFree, victim)
    registerBlueprint(wFree, normalComp)

    const py = WORLD_H - 11
    // Place victim plant at x=80, allelopathic/normal plant 5 tiles to the right (within ALLELOPATHY_RADIUS=8)
    spawnCreature(wSuppressed, victim, 80, py)
    spawnCreature(wSuppressed, allelopathicComp, 85, py)
    spawnCreature(wFree, victim, 80, py)
    spawnCreature(wFree, normalComp, 85, py)

    // Force breedCooldown to 0 so they can breed immediately
    for (const c of wSuppressed.creatures) c.breedCooldown = 0
    for (const c of wFree.creatures) c.breedCooldown = 0

    const rng = makeRng(42)
    const eventsSuppressed: SimEvent[] = []
    const eventsFree: SimEvent[] = []

    // 180 s at 60 Hz
    for (let i = 0; i < 10800; i++) {
      tickCreatures(wSuppressed, 1 / 60, rng, 1, eventsSuppressed)
      tickCreatures(wFree, 1 / 60, rng, 1, eventsFree)
    }

    const suppressedBirths = countBirths(victim.id, eventsSuppressed)
    const freeBirths = countBirths(victim.id, eventsFree)

    expect(freeBirths).toBeGreaterThan(suppressedBirths)
  })

  it('novelCompoundResistant plant is not suppressed by allelopathic neighbor', { timeout: 30000 }, () => {
    const wResistant = mudWorld()
    const wVulnerable = mudWorld()

    const resistant = makePlant('Resistant', { novelCompoundResistant: true })
    const vulnerable = makePlant('Vulnerable')
    const allelopathicComp = makePlant('Allelopathic', { allelopathic: true })

    registerBlueprint(wResistant, resistant)
    registerBlueprint(wResistant, allelopathicComp)
    registerBlueprint(wVulnerable, vulnerable)

    // Need a separate allelopathic blueprint for the second world
    const allelopathicComp2 = makePlant('Allelopathic2', { allelopathic: true })
    registerBlueprint(wVulnerable, allelopathicComp2)

    const py = WORLD_H - 11
    spawnCreature(wResistant, resistant, 80, py)
    spawnCreature(wResistant, allelopathicComp, 85, py)
    spawnCreature(wVulnerable, vulnerable, 80, py)
    spawnCreature(wVulnerable, allelopathicComp2, 85, py)

    for (const c of wResistant.creatures) c.breedCooldown = 0
    for (const c of wVulnerable.creatures) c.breedCooldown = 0

    const rng = makeRng(42)
    const eventsResistant: SimEvent[] = []
    const eventsVulnerable: SimEvent[] = []

    for (let i = 0; i < 10800; i++) {
      tickCreatures(wResistant, 1 / 60, rng, 1, eventsResistant)
      tickCreatures(wVulnerable, 1 / 60, rng, 1, eventsVulnerable)
    }

    const resistantBirths = countBirths(resistant.id, eventsResistant)
    const vulnerableBirths = countBirths(vulnerable.id, eventsVulnerable)

    // Resistant should breed at least as often as vulnerable (and likely more)
    expect(resistantBirths).toBeGreaterThanOrEqual(vulnerableBirths)
  })
})
