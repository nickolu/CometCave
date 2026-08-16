/**
 * Invasive species — enemy release effect.
 *
 * Invasive species with invasive: true breed faster (cooldown × 0.67) and
 * are more resistant to disease (effective immunity +0.56 above baseline).
 *
 * Tests cover:
 *   1. sanitizeBlueprint preserves invasive: true/false/absent.
 *   2. Invasive species produce more offspring than non-invasive over N seconds.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import type { SimEvent } from '@/app/micro-land/domain/sim/creature-sim'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import { lifespanOf } from '@/app/micro-land/domain/traits'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// 1. Blueprint flag tests
// ---------------------------------------------------------------------------

describe('invasive — sanitizeBlueprint', () => {
  const base = {
    name: 'Invader',
    tags: ['meat'] as const,
    art: {
      palette: { a: '#ff6600' },
      frames: [['aaa', 'aaa', 'aaa']],
      frameMs: 200,
      faceMotion: false,
    },
    move: { kind: 'walk' as const, speed: 0 },
    diet: { eats: [] as const, hungerRate: 0.01, lifespanSeconds: 900 },
    senses: { sight: 4 },
  }

  it('preserves invasive: true', () => {
    const bp = sanitizeBlueprint({ ...base, invasive: true }, { summoned: true })
    expect(bp.invasive).toBe(true)
  })

  it('preserves invasive: false', () => {
    const bp = sanitizeBlueprint({ ...base, invasive: false }, { summoned: true })
    expect(bp.invasive).toBe(false)
  })

  it('defaults invasive to false when absent', () => {
    const bp = sanitizeBlueprint(base, { summoned: true })
    expect(bp.invasive).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flatWorld(): WorldState {
  const w = createWorld(99)
  for (let y = WORLD_H - 4; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  w.elapsed = 1 // avoid t=0 disease outbreak trigger
  return w
}

/**
 * A rooted plant blueprint — plants breed alone (no partner needed), so the
 * only variable between runs is the cooldown. hungerRate=0 means hunger never
 * accumulates, so breedCost doesn't cap births.
 */
function invasivePlant(invasive: boolean): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: invasive ? 'InvasiveMoss' : 'NativeMoss',
      tags: ['plant'],
      art: {
        palette: { a: '#44aa44' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'root', speed: 0 },
      diet: {
        eats: [],
        hungerRate: 0,
        lifespanSeconds: 900,
        breedAt: 0.1,
      },
      senses: { sight: 4 },
      invasive,
    },
    { summoned: true }
  )
}

/** Set a creature to full adult readiness: well-fed, mature, off cooldown. */
function readyAdult(c: Creature, bp: CreatureBlueprint): Creature {
  c.hunger = 0
  c.ageSeconds = lifespanOf(c, bp) * TUNING.lifespanScale * 0.3
  c.breedCooldown = 0
  return c
}

// ---------------------------------------------------------------------------
// 2. Invasive breeds faster
//
// Using rooted plants: they breed alone, have zero hunger rate (so breedCost
// does not accumulate to block further breeding), and their offspring spread
// across the world. The 0.67× cooldown multiplier creates a measurable birth
// count difference over 60 seconds.
// ---------------------------------------------------------------------------

describe('invasive — faster reproduction', () => {
  it('invasive plant produces more births than non-invasive over 60 s', () => {
    const wInvasive = flatWorld()
    const wNative = flatWorld()

    const bpInvasive = invasivePlant(true)
    const bpNative = invasivePlant(false)

    registerBlueprint(wInvasive, bpInvasive)
    registerBlueprint(wNative, bpNative)

    // One plant each, ready to spread
    const c1 = spawnCreature(wInvasive, bpInvasive, 80, WORLD_H - 5)!
    const c2 = spawnCreature(wNative, bpNative, 80, WORLD_H - 5)!
    readyAdult(c1, bpInvasive)
    readyAdult(c2, bpNative)

    const rng = makeRng(7)
    const eventsInvasive: SimEvent[] = []
    const eventsNative: SimEvent[] = []

    // 60 s at 60 Hz
    for (let i = 0; i < 3600; i++) {
      tickCreatures(wInvasive, 1 / 60, rng, 1, eventsInvasive)
      tickCreatures(wNative, 1 / 60, rng, 1, eventsNative)
    }

    const invasiveBirths = eventsInvasive.filter(e => e.kind === 'born' && e.blueprintId === bpInvasive.id).length
    const nativeBirths = eventsNative.filter(e => e.kind === 'born' && e.blueprintId === bpNative.id).length

    // Invasive should breed noticeably faster due to 0.67x cooldown multiplier
    expect(invasiveBirths).toBeGreaterThan(nativeBirths)
  })
})
