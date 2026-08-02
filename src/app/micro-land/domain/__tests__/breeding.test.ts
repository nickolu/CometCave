/**
 * Breeding needs two of you, and both have to have eaten.
 *
 * These are the rules that are cheapest to break by accident. Every one of them
 * is invisible in a browser — a world where nothing can pair up looks exactly
 * like a world that is merely unlucky, for about four minutes, and then looks
 * like an empty world. The headless harness catches the *balance*; this catches
 * the mechanic.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import type { SimEvent } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

/** Ground to stand on, and no seed bank running underneath the experiment. */
function bareWorld(): WorldState {
  const w = createWorld(4242)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  // `seedNativePlants` would otherwise sprout things mid-test and the born
  // events would stop meaning what the assertions think they mean.
  w.dormant = true
  return w
}

/**
 * A long-lived walker. The lifespan is generous on purpose: maturity is a fifth
 * of it, so a short-lived test creature is either a baby or nearly dead.
 */
function grazer(overrides: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Grazer',
      tags: ['meat'],
      art: {
        palette: { a: '#ff0000' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: true,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: ['plant'], hungerRate: 0, lifespanSeconds: 400 },
      senses: { sight: 20 },
      ...overrides,
    },
    { summoned: true }
  )
}

/** Grown up, off cooldown, and as full as it gets. */
function readyAdult(c: Creature): Creature {
  c.hunger = 0
  c.ageSeconds = 120
  c.breedCooldown = 0
  return c
}

/** Run the simulation and hand back every birth that happened. */
function run(w: WorldState, seconds: number): SimEvent[] {
  const rng = makeRng(7)
  const events: SimEvent[] = []
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, events)
  return events.filter(e => e.kind === 'born')
}

/** Put `count` of `bp` down next to each other, all of them ready to breed. */
function placeAdults(w: WorldState, bp: CreatureBlueprint, count: number): Creature[] {
  const out: Creature[] = []
  for (let i = 0; i < count; i++) {
    const c = spawnCreature(w, bp, 40 + i * 2, WORLD_H - 16)
    if (c) out.push(readyAdult(c))
  }
  return out
}

describe('an animal needs a partner', () => {
  it('will not breed alone, however well fed it is', () => {
    const w = bareWorld()
    const bp = grazer()
    registerBlueprint(w, bp)
    placeAdults(w, bp, 1)

    expect(run(w, 30)).toHaveLength(0)
    expect(w.creatures).toHaveLength(1)
  })

  it('breeds when there are two of them', () => {
    const w = bareWorld()
    const bp = grazer()
    registerBlueprint(w, bp)
    placeAdults(w, bp, 2)

    expect(run(w, 30).length).toBeGreaterThan(0)
  })

  it('will not breed with another species standing right there', () => {
    const w = bareWorld()
    const a = grazer({ name: 'Alpha' })
    const b = grazer({ name: 'Beta' })
    registerBlueprint(w, a)
    registerBlueprint(w, b)
    readyAdult(spawnCreature(w, a, 40, WORLD_H - 16)!)
    readyAdult(spawnCreature(w, b, 42, WORLD_H - 16)!)

    expect(run(w, 30)).toHaveLength(0)
  })

  it('will not breed with a partner too far away to reach', () => {
    const w = bareWorld()
    // Speed 0 means neither can close the gap, so this isolates the distance
    // rule from the walking that normally satisfies it.
    const bp = grazer()
    registerBlueprint(w, bp)
    readyAdult(spawnCreature(w, bp, 40, WORLD_H - 16)!)
    readyAdult(spawnCreature(w, bp, 40 + TUNING.mateRadius * 3, WORLD_H - 16)!)

    expect(run(w, 30)).toHaveLength(0)
  })
})

describe('both of them have to be well fed', () => {
  it('will not breed when the partner is hungry', () => {
    const w = bareWorld()
    const bp = grazer()
    registerBlueprint(w, bp)
    const [, partner] = placeAdults(w, bp, 2)
    partner.hunger = 0.9

    expect(run(w, 30)).toHaveLength(0)
  })

  it('will not breed when the partner is still on cooldown', () => {
    const w = bareWorld()
    const bp = grazer()
    registerBlueprint(w, bp)
    const [, partner] = placeAdults(w, bp, 2)
    partner.breedCooldown = 999

    expect(run(w, 30)).toHaveLength(0)
  })

  it('will not breed when the partner is too young', () => {
    const w = bareWorld()
    const bp = grazer()
    registerBlueprint(w, bp)
    const [, partner] = placeAdults(w, bp, 2)
    partner.ageSeconds = 0

    expect(run(w, 30)).toHaveLength(0)
  })

  it('charges both parents, not just the one whose turn it was', () => {
    const w = bareWorld()
    const bp = grazer()
    registerBlueprint(w, bp)
    const parents = placeAdults(w, bp, 2)

    // Two seconds, not thirty: the pair meets within a few ticks, and the whole
    // point is to look at them while the cooldown they were charged is still
    // running rather than after it has quietly expired.
    expect(run(w, 2)).toHaveLength(1)
    for (const p of parents) {
      expect(p.children).toBe(1)
      expect(p.hunger).toBeGreaterThanOrEqual(TUNING.breedCost)
      expect(p.breedCooldown).toBeGreaterThan(0)
    }
  })
})

describe('plants spread alone', () => {
  it('a rooted plant makes another with nothing else alive', () => {
    const w = bareWorld()
    const moss = sanitizeBlueprint(
      {
        name: 'Test Moss',
        tags: ['plant'],
        art: { palette: { a: '#00ff00' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 400 },
        move: { kind: 'root' },
        diet: { eats: [], hungerRate: 0, breedAt: 0.2, lifespanSeconds: 400 },
      },
      { summoned: true }
    )
    registerBlueprint(w, moss)
    readyAdult(spawnCreature(w, moss, 40, WORLD_H - 15)!)

    expect(run(w, 30).length).toBeGreaterThan(0)
  })

  /**
   * The regression this file exists for.
   *
   * Skybloom is a flower that never landed — `tags: ['plant']`, eats nothing,
   * and *flies*, with two tiles of sight. The first cut of the partner rule
   * asked "is it rooted?" instead of "is it a plant?", so Skybloom was told to
   * go and find a mate it was constitutionally incapable of seeing. It went from
   * a steady 65 on earth to extinct in every run.
   */
  it('a plant that flies still spreads alone', () => {
    const w = bareWorld()
    const flower = sanitizeBlueprint(
      {
        name: 'Test Skyflower',
        tags: ['plant'],
        art: { palette: { a: '#ffaaff' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 400 },
        move: { kind: 'fly', speed: 0 },
        diet: { eats: [], hungerRate: 0, breedAt: 0.2, lifespanSeconds: 400 },
        senses: { sight: 2 },
      },
      { summoned: true }
    )
    registerBlueprint(w, flower)
    readyAdult(spawnCreature(w, flower, 40, WORLD_H - 20)!)

    expect(run(w, 30).length).toBeGreaterThan(0)
  })
})

describe('nothing is afraid of its own kind', () => {
  /**
   * A model asked for something timid writes `tags: ['meat','bug']` and
   * `fears: ['bug']` without noticing it has described a creature that runs away
   * from itself. Harmless before breeding needed a partner; sterility after.
   */
  it('strips self-tags out of what a creature fears', () => {
    const bp = grazer({ tags: ['meat', 'bug'], diet: { eats: ['plant'], fears: ['bug', 'fish'] } })
    expect(bp.diet.fears).toEqual(['fish'])
  })

  it('lets a self-fearing blueprint breed anyway', () => {
    const w = bareWorld()
    const bp = grazer({ tags: ['meat', 'bug'], diet: { eats: ['plant'], fears: ['bug'] } })
    registerBlueprint(w, bp)
    placeAdults(w, bp, 2)

    expect(run(w, 30).length).toBeGreaterThan(0)
  })
})
