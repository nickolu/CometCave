/**
 * Industrial melanism — pollution darkens substrate, creating selection pressure
 * for dark cryptic variants.
 *
 * Mechanism:
 *   1. Creatures with `polluter: true` convert dirt/grass tiles they walk over
 *      to ash (POLLUTION_PROB = 0.001/tick → ~6%/s).
 *   2. Ash (#4a4550) has near-zero saturation (d=0.043 < hexHue threshold 0.05),
 *      so hexHue returns -1 (achromatic). crypticCamouflage returns a flat 0.3
 *      for any creature hue on ash — it does not provide directional selection
 *      for dark-hued variants on its own.
 *   3. The directional selection pressure (dark moths surviving on soot) is
 *      captured at the population level: the pollution substrate removes the hue
 *      advantage that bright-coloured cryptic prey had on brighter substrates,
 *      making overall camouflage lower (0.3 vs up to 1.0 on matching dirt),
 *      creating an opening for non-cryptic darker individuals.
 *
 * Tests cover:
 *   1. Flag preserved through sanitizeBlueprint.
 *   2. Polluter converts dirt to ash over time.
 *   3. Non-polluter leaves dirt unchanged.
 *   4. Polluter on mud has no effect (only dirt and grass are affected).
 *   5. Ash is achromatic to hexHue — the tile gives uniform 0.3 to all hues.
 *   6. The contrast: on dirt (~27°), a hue-matching cryptic creature gets
 *      much better camouflage (up to 1.0) than on ash (0.3) — illustrating
 *      why pollution disrupts the existing camouflage advantage.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_BY_INDEX, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { crypticCamouflage, hexHue, tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

function dirtWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

function mudWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 12; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.mud
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

function polluter(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Polluter',
      tags: ['meat'],
      art: {
        palette: { a: '#442211' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 4 },
      ...extra,
    },
    { summoned: true }
  )
}

function runSim(w: WorldState, seconds: number): void {
  const rng = makeRng(42)
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

describe('industrial melanism — polluter tile conversion', () => {
  it('polluter flag is preserved through sanitizeBlueprint', () => {
    expect(polluter({ polluter: true }).polluter).toBe(true)
    expect(polluter({ polluter: false }).polluter).toBe(false)
    expect(polluter().polluter).toBe(false)
  })

  it('polluter converts dirt to ash over 60 s', () => {
    const w = dirtWorld()
    const bp = polluter({ polluter: true })
    registerBlueprint(w, bp)

    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 60)

    let foundAsh = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.ash) {
          foundAsh = true
        }
      }
    }
    expect(foundAsh).toBe(true)
  })

  it('non-polluter creature on dirt leaves tiles unchanged', () => {
    const w = dirtWorld()
    const bp = polluter() // polluter=false
    registerBlueprint(w, bp)

    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 60)

    let foundAsh = false
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] === MATERIAL_INDEX.ash) {
          foundAsh = true
        }
      }
    }
    expect(foundAsh).toBe(false)
  })

  it('polluter on mud does not convert mud to ash (only dirt and grass)', () => {
    const w = mudWorld()
    const bp = polluter({ polluter: true })
    registerBlueprint(w, bp)

    spawnCreature(w, bp, 40, WORLD_H - 16)
    runSim(w, 30)

    let allMud = true
    for (let y = WORLD_H - 12; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (w.tiles[y * WORLD_W + x] !== MATERIAL_INDEX.mud) {
          allMud = false
        }
      }
    }
    expect(allMud).toBe(true)
  })
})

describe('industrial melanism — selection pressure mechanics', () => {
  it('ash is achromatic — gives uniform 0.3 camouflage to any creature hue', () => {
    // Ash (#4a4550): R=74 G=69 B=80, delta=11/255=0.043 < hexHue threshold 0.05.
    // hexHue returns -1 (achromatic), so crypticCamouflage returns 0.3 for all hues.
    const ashMat = MATERIAL_BY_INDEX[MATERIAL_INDEX.ash]
    expect(ashMat).toBeDefined()
    const ashHue = hexHue(ashMat!.color)
    expect(ashHue).toBe(-1) // achromatic

    // Any creature hue gives the same flat score on ash.
    expect(crypticCamouflage(0, ashHue)).toBe(0.3)
    expect(crypticCamouflage(120, ashHue)).toBe(0.3)
    expect(crypticCamouflage(270, ashHue)).toBe(0.3)
  })

  it('pollution destroys cryptic advantage: dirt hue-match gives 1.0, ash gives 0.3', () => {
    // A dirt-matching cryptic creature has near-perfect camouflage on clean
    // substrate, but pollution (ash) collapses that to a flat 0.3.
    // This is how pollution disrupts the existing camouflage landscape and
    // opens niches for non-cryptic darker individuals.
    const dirtHue = hexHue(MATERIAL_BY_INDEX[MATERIAL_INDEX.dirt]!.color) // ≈27°
    const ashHue = hexHue(MATERIAL_BY_INDEX[MATERIAL_INDEX.ash]!.color)  // -1 achromatic

    const scoreOnDirt = crypticCamouflage(dirtHue, dirtHue) // matching hue on dirt
    const scoreOnAsh = crypticCamouflage(dirtHue, ashHue)   // same creature on ash

    expect(scoreOnDirt).toBeCloseTo(1, 1) // excellent camouflage on dirt
    expect(scoreOnAsh).toBe(0.3)          // collapsed to base on ash
    expect(scoreOnDirt).toBeGreaterThan(scoreOnAsh)
  })
})
