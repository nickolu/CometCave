import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_IDS, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import { neutralTraits } from '@/app/micro-land/domain/traits'
import {
  decodeTiles,
  encodeTiles,
  restoreSnapshot,
  snapshotWorld,
} from '@/app/micro-land/worlds/snapshot'

/** A world with some ground, a summoned species, and a few of them alive in it. */
function populatedWorld() {
  const w = createWorld(4242)
  for (let y = WORLD_H - 20; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }

  const bp = sanitizeBlueprint(
    {
      name: 'Test Grazer',
      body: { pixels: ['ab', 'ba'], palette: { a: '#ff0000', b: '#00ff00' } },
      move: { kind: 'walk' },
      diet: { eats: ['plant'], lifespanSeconds: 120 },
    },
    { summoned: true }
  )
  registerBlueprint(w, bp)

  for (let i = 0; i < 5; i++) spawnCreature(w, bp, 10 + i * 4, WORLD_H - 22)
  return { w, bp }
}

describe('run-length encoding the tile grid', () => {
  it('collapses a uniform world to a single run', () => {
    const tiles = new Uint8Array(1000)
    expect(encodeTiles(tiles)).toEqual([0, 1000])
  })

  it('round-trips an arbitrary grid', () => {
    const tiles = new Uint8Array(500)
    for (let i = 0; i < tiles.length; i++) tiles[i] = ((i / 7) | 0) % MATERIAL_IDS.length
    const back = new Uint8Array(500)
    expect(decodeTiles(encodeTiles(tiles), back)).toBe(true)
    expect(Array.from(back)).toEqual(Array.from(tiles))
  })

  it('reads a material this build does not have as air, not as whatever is there', () => {
    const into = new Uint8Array(4)
    expect(decodeTiles([MATERIAL_IDS.length + 3, 4], into)).toBe(true)
    expect(Array.from(into)).toEqual([0, 0, 0, 0])
  })

  it('round-trips a grid that alternates every tile', () => {
    const tiles = new Uint8Array(64)
    for (let i = 0; i < tiles.length; i++) tiles[i] = i % 2
    const runs = encodeTiles(tiles)
    expect(runs).toHaveLength(128)
    const back = new Uint8Array(64)
    expect(decodeTiles(runs, back)).toBe(true)
    expect(Array.from(back)).toEqual(Array.from(tiles))
  })

  it('refuses runs that do not cover the grid', () => {
    const into = new Uint8Array(100)
    expect(decodeTiles([1, 40], into)).toBe(false)
  })

  it('refuses runs that overflow the grid rather than writing past the end', () => {
    const into = new Uint8Array(100)
    expect(decodeTiles([1, 90, 2, 90], into)).toBe(false)
  })

  it('refuses a zero-length run, which a naive decoder would loop on', () => {
    const into = new Uint8Array(10)
    expect(decodeTiles([1, 0, 1, 10], into)).toBe(false)
  })
})

describe('freezing and thawing a world', () => {
  it('brings back the terrain tile for tile', () => {
    const { w } = populatedWorld()
    const snap = snapshotWorld(w)

    const fresh = createWorld(1)
    expect(restoreSnapshot(fresh, snap)).toBe(true)
    expect(Array.from(fresh.tiles)).toEqual(Array.from(w.tiles))
  })

  it('brings back every creature mid-life, not reset', () => {
    const { w } = populatedWorld()
    w.creatures[0].hunger = 0.77
    w.creatures[0].ageSeconds = 91.5
    w.creatures[0].mealsEaten = 12
    w.creatures[0].generation = 4
    w.creatures[0].name = 'Bramble'
    w.elapsed = 300.25

    const fresh = createWorld(1)
    restoreSnapshot(fresh, snapshotWorld(w))

    expect(fresh.creatures).toHaveLength(5)
    expect(fresh.elapsed).toBeCloseTo(300.25, 2)
    const first = fresh.creatures[0]
    expect(first.hunger).toBeCloseTo(0.77, 2)
    expect(first.ageSeconds).toBeCloseTo(91.5, 2)
    expect(first.mealsEaten).toBe(12)
    expect(first.generation).toBe(4)
    expect(first.name).toBe('Bramble')
  })

  /**
   * The failure this guards against is invisible: a reopened world would have
   * all of its creatures, in the right places, at the right ages — and every
   * line the player had grown would silently be back to its blueprint.
   */
  it('brings back what each creature inherited', () => {
    const { w } = populatedWorld()
    // Spread over neutral rather than written out: the trait set has grown from
    // five to fourteen, and a hand-written literal here is what stopped this
    // test noticing that the save format had been silently dropping nine of
    // them. `toxicity` and `camouflage` are asserted below for that reason.
    w.creatures[0].traits = {
      ...neutralTraits(),
      speed: 1.37,
      sight: 0.72,
      lifespan: 1.15,
      hue: 214,
      shade: 0.9,
      toxicity: 0.61,
      camouflage: 0.44,
    }

    const fresh = createWorld(1)
    restoreSnapshot(fresh, snapshotWorld(w))

    const first = fresh.creatures[0]
    expect(first.traits.speed).toBeCloseTo(1.37, 2)
    expect(first.traits.sight).toBeCloseTo(0.72, 2)
    expect(first.traits.lifespan).toBeCloseTo(1.15, 2)
    expect(first.traits.hue).toBeCloseTo(214, 0)
    expect(first.traits.shade).toBeCloseTo(0.9, 2)
    // The two that were being dropped. Not decoration: these fail against the
    // old five-field save format and pass against the current one.
    expect(first.traits.toxicity).toBeCloseTo(0.61, 2)
    expect(first.traits.camouflage).toBeCloseTo(0.44, 2)
    // Untouched creatures stay exactly their species, which is what makes a
    // placed creature and a born one different things.
    expect(fresh.creatures[1].traits).toEqual(neutralTraits())
  })

  it('thaws a world saved before creatures inherited anything into neutral ones', () => {
    const { w } = populatedWorld()
    const snap = snapshotWorld(w)
    for (const c of snap.creatures) delete c.traits

    const fresh = createWorld(1)
    expect(restoreSnapshot(fresh, snap)).toBe(true)
    expect(fresh.creatures[0].traits.speed).toBe(1)
    expect(fresh.creatures[0].traits.hue).toBe(0)
  })

  it('carries the summoned species so the world can be opened anywhere', () => {
    const { w, bp } = populatedWorld()
    const snap = snapshotWorld(w)
    expect(snap.blueprints.map(b => b.id)).toEqual([bp.id])

    // A world that has never heard of this species.
    const fresh = createWorld(1)
    expect(fresh.blueprints[bp.id]).toBeUndefined()
    restoreSnapshot(fresh, snap)
    expect(fresh.blueprints[bp.id]?.name).toBe('Test Grazer')
  })

  it('leaves behind creatures whose species did not survive the trip', () => {
    const { w, bp } = populatedWorld()
    const snap = snapshotWorld(w)
    // As if the blueprint had been pruned from the save.
    snap.blueprints = []

    const fresh = createWorld(1)
    restoreSnapshot(fresh, snap)
    expect(fresh.creatures.filter(c => c.blueprintId === bp.id)).toHaveLength(0)
  })

  it('never lets natives point at a species that is not there', () => {
    const { w } = populatedWorld()
    const snap = snapshotWorld(w)
    snap.natives = [...snap.natives, 'summon:ghost:999']

    const fresh = createWorld(1)
    restoreSnapshot(fresh, snap)
    expect(fresh.natives).not.toContain('summon:ghost:999')
    for (const id of fresh.natives) expect(fresh.blueprints[id]).toBeDefined()
  })

  it('hands out ids above everything already alive', () => {
    const { w } = populatedWorld()
    const snap = snapshotWorld(w)
    // A save whose counter has fallen behind its own population.
    snap.nextCreatureId = 1

    const fresh = createWorld(1)
    restoreSnapshot(fresh, snap)
    const highest = Math.max(...fresh.creatures.map(c => c.id))
    expect(fresh.nextCreatureId).toBeGreaterThan(highest)
  })

  it('drops particles rather than thawing a frozen puff of sparks', () => {
    const { w } = populatedWorld()
    const fresh = createWorld(1)
    fresh.particles.push({ x: 1, y: 1, vx: 0, vy: 0, life: 1, maxLife: 1, color: '#fff' })
    restoreSnapshot(fresh, snapshotWorld(w))
    expect(fresh.particles).toHaveLength(0)
  })

  it('leaves the world alone when the tiles cannot be decoded', () => {
    const { w } = populatedWorld()
    const snap = snapshotWorld(w)
    snap.tiles = [1, 10]

    const fresh = createWorld(1)
    const before = Array.from(fresh.tiles)
    expect(restoreSnapshot(fresh, snap)).toBe(false)
    expect(Array.from(fresh.tiles)).toEqual(before)
  })
})
