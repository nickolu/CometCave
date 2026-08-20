/**
 * A swimmer stays under the water it needs.
 *
 * Both tests reproduce the same field report from two directions: fish that
 * "get stuck moving back and forth and up" until they are pinned at the top of
 * the pool, where they starve or drown. Two independent things put them there.
 *
 * The physics: buoyancy used to be all-or-nothing above `wet > 0.3`, so a
 * neutral fish (`buoyancy: 1`) that was a third submerged had its gravity
 * switched fully off and hung at the waterline with nothing to pull it back
 * under.
 *
 * The steering: `flee` is the reciprocal of the bearing to the threat, so a
 * fish with a predator below it swam *up* — out of the water, out of its
 * habitat, and into the drowning timer, all to escape something that could not
 * follow it there.
 *
 * The pool is deliberately static: `tickTiles` is never called, so the water
 * neither flows nor drains and `wet` measures the creature's choice rather than
 * the terrain's.
 */
import { describe, expect, it } from 'vitest'

import { bodyBox, sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import {
  boxLiquidFraction,
  createWorld,
  registerBlueprint,
  spawnCreature,
} from '@/app/micro-land/domain/sim/world'
import type { Creature, CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

/** Surface of the pool: air above this row, water from it down to the floor. */
const SURFACE = 60
const FLOOR = WORLD_H - 12

function pool(): WorldState {
  const w = createWorld(7)
  const water = MATERIAL_INDEX.water
  const stone = MATERIAL_INDEX.stone
  for (let y = SURFACE; y < FLOOR; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = water
  }
  for (let y = FLOOR; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = stone
  }
  // Nothing generative: no seed bank, no sprouts wandering into the assertions.
  w.dormant = true
  w.elapsed = 1
  return w
}

function fishBp(id: string, extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint({
    name: id,
    tags: ['fish'],
    art: { palette: { a: '#3399ff' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 200 },
    move: { kind: 'swim', speed: 5, jump: 0, restlessness: 0.4 },
    // Neutral buoyancy is the case that used to hang at the waterline: gravity
    // and lift cancel exactly, so nothing decided which way it went.
    body: { mass: 0.4, bounce: 0.1, drag: 0.45, buoyancy: 1, immuneTo: [] },
    habitat: { needs: ['water'], drowns: false },
    diet: { eats: [], fears: [], lifespanSeconds: 600 },
    ...extra,
  })
}

function wetness(w: WorldState, c: Creature, bp: CreatureBlueprint): number {
  const body = bodyBox(bp)
  return boxLiquidFraction(w, c.x + body.dx, c.y + body.dy, body.w, body.h)
}

function run(w: WorldState, seconds: number, each?: () => void): void {
  const rng = makeRng(99)
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    w.elapsed += 1 / 60
    tickCreatures(w, 1 / 60, rng, 1, [])
    each?.()
  }
}

describe('a swimmer at the waterline sinks back under', () => {
  it('a fish two-thirds out of the water submerges instead of hanging there', () => {
    const w = pool()
    const bp = fishBp('surfacer')
    registerBlueprint(w, bp)
    // Top-left at SURFACE - 2 puts one of its three rows in the water: 0.33,
    // just over the old threshold, which is exactly where gravity used to
    // switch off.
    const fish = spawnCreature(w, bp, 100, SURFACE - 2)
    expect(fish).not.toBeNull()
    expect(wetness(w, fish!, bp)).toBeLessThan(0.5)

    run(w, 4)

    expect(w.creatures).toContain(fish!)
    expect(wetness(w, fish!, bp)).toBe(1)
  })
})

describe('a swimmer flees sideways, not out of the pool', () => {
  it('a fish with a predator below it stays in the water', () => {
    const w = pool()
    const prey = fishBp('flee-fish', { senses: { sight: 30 } })
    const hunter = sanitizeBlueprint({
      name: 'stalker-fish',
      tags: ['predator'],
      art: { palette: { a: '#993333' }, frames: [['aaa', 'aaa', 'aaa']], frameMs: 200 },
      // Stationary, so the geometry under test stays the geometry under test.
      move: { kind: 'swim', speed: 0, jump: 0, restlessness: 0 },
      body: { mass: 1, bounce: 0, drag: 0.4, buoyancy: 1, immuneTo: [] },
      habitat: { needs: ['water'], drowns: false },
      diet: { eats: ['fish'], fears: [], lifespanSeconds: 600 },
    })
    registerBlueprint(w, prey)
    registerBlueprint(w, hunter)

    // Prey four tiles under the surface, predator ten tiles below the prey —
    // near enough to be seen, far enough that "away" is unambiguously upward.
    const fish = spawnCreature(w, prey, 200, SURFACE + 4)
    const pred = spawnCreature(w, hunter, 200, SURFACE + 14)
    expect(fish).not.toBeNull()
    expect(pred).not.toBeNull()

    let fled = false
    let driest = 1
    run(w, 6, () => {
      if (!w.creatures.includes(fish!)) return
      if (fish!.mood === 'flee') fled = true
      driest = Math.min(driest, wetness(w, fish!, prey))
    })

    // The test is only worth anything if the fish actually ran.
    expect(fled).toBe(true)
    /**
     * Not `toBe(1)`: a fleeing fish is entitled to press right up under the
     * surface, and a body resting on a fractional `y` straddles one more tile
     * row than it is tall, so the fraction reads a little under 1 while every
     * part of the animal is still wet. The number that matters is how far this
     * is from the 0.25 the habitat check kills at — the same run against the
     * old buoyancy and the old steering ends at exactly 0.25, a fish three
     * quarters out of the pool with the drowning timer already running.
     */
    expect(driest).toBeGreaterThan(0.6)
    expect(fish!.distress).toBe(0)
  })
})
