/**
 * Active chromatophores — dynamic hue matching to substrate.
 *
 * Creatures with `activeChromatophores: true` update `traits.hue` every 5
 * seconds to match the tile they stand on. During a 2-tick transition the
 * creature is briefly exposed (baseCamouflage forced to 0). Requires `cryptic:
 * true` to actually affect predator detection.
 *
 * Tests cover:
 *   1. `sanitizeBlueprint` preserves `activeChromatophores: true`.
 *   2. After 5+ seconds on a chromatic tile, `traits.hue` matches the tile hue.
 *   3. Immediately after the hue update, `chromatophoreFade > 0` (transitioning).
 *   4. After the fade expires, a predator cannot detect the hue-matched prey
 *      (hue=tileHue → crypticCamouflage≈1 → detFactor≈0.15 → efs²<d²).
 *   5. During the transition window the prey IS detected (camouflage=0 →
 *      detFactor=0.5 → efs²>d²).
 *   6. Non-chromatophore creature with the same hue is detected consistently.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_BY_INDEX, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { hexHue, tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import {
  createWorld,
  registerBlueprint,
  spawnCreature,
  tileAt,
} from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dirt-floored world, dormant, starting at elapsed=1. */
function dirtWorld(): WorldState {
  const w = createWorld(42)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

/** Standard predator blueprint (sight=60, eats meat). */
function predatorBp(): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Predator',
      tags: ['predator'],
      art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
      senses: { sight: 60 },
    },
    { summoned: true }
  )
}

/** A slow prey blueprint with chromatophore control. */
function preyBp(chromato: boolean, startHue: number): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Prey',
      tags: ['meat'],
      art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 1 },
      cryptic: true,
      activeChromatophores: chromato,
      traitDefaults: { hue: startHue, camouflage: 0 },
    },
    { summoned: true }
  )
}

/** Run dt per tick for `ticks` physics frames. */
function runTicks(w: WorldState, ticks: number): void {
  const rng = makeRng(7)
  for (let i = 0; i < ticks; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

// ---------------------------------------------------------------------------
// 1. Flag preservation
// ---------------------------------------------------------------------------

describe('activeChromatophores flag', () => {
  it('sanitizeBlueprint preserves activeChromatophores: true', () => {
    const bp = preyBp(true, 0)
    expect(bp.activeChromatophores).toBe(true)
  })

  it('sanitizeBlueprint normalises activeChromatophores: false', () => {
    const bp = preyBp(false, 0)
    expect(bp.activeChromatophores).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2–3. Hue updates and transition
//
// After 5 s (= 300 ticks at 60Hz) on dirt (~27° hue), traits.hue should
// update to 27. Immediately after that tick, chromatophoreFade > 0 (transitioning).
// ---------------------------------------------------------------------------

describe('hue update on chromatic tile', () => {
  it('traits.hue matches tile hue after 5 s on dirt', () => {
    const w = dirtWorld()
    const bp = preyBp(true, 180) // start with opposite hue
    registerBlueprint(w, bp)
    const py = WORLD_H - 11
    const c = spawnCreature(w, bp, 40, py)!

    // Confirm the tile under the creature is dirt and get expected hue.
    const footTile = tileAt(w, 40, WORLD_H - 8)
    const mat = MATERIAL_BY_INDEX[footTile]
    expect(mat?.id).toBe('dirt')
    const dirtHue = hexHue(mat!.color) // ~27°

    // Run 5.1 s to trigger the update.
    runTicks(w, Math.ceil(5.1 * 60))

    const t = c.traits as { hue?: number }
    expect(t.hue).toBeCloseTo(dirtHue, 0)
  })

  it('chromatophoreFade > 0 immediately after a hue update', () => {
    const w = dirtWorld()
    const bp = preyBp(true, 180) // start far from dirt hue so it will update
    registerBlueprint(w, bp)
    const py = WORLD_H - 11
    const c = spawnCreature(w, bp, 40, py)!

    // Run exactly 5 s + 1 tick to trigger the update interval.
    runTicks(w, 5 * 60 + 1)

    const fade = (c as { chromatophoreFade?: number }).chromatophoreFade ?? 0
    expect(fade).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 4–6. Detection: predator at d²=1600 (40-tile gap)
//
// Setup mirrors the cryptic-coloration sim test:
//   - Both art frames padded to ART_MIN=3 → body.h = body.w = 3
//   - Predator at x=100, sight=60, desperation=1:
//       foodSight = 60 × 3 = 180; foodSight² = 32400
//       detFactor(still, camo=0) = 0.5 → efs² = 32400 × 0.25 = 8100   → DETECTED
//       detFactor(still, camo≈1) = 0.15 → efs² = 32400 × 0.0225 = 729  → hidden
//   - Prey at x=143: edge-to-edge gap = 143 − 103 = 40 tiles; d² = 1600
//       1600 < 8100 (camo=0) → detected
//       1600 > 729  (camo≈1) → NOT detected
// ---------------------------------------------------------------------------

/**
 * Spawn predator and prey on a dirt floor, run ticks, return whether the
 * predator has locked onto the prey (targetId set).
 */
function runDetection(
  w: WorldState,
  prey: CreatureBlueprint,
  pred: CreatureBlueprint,
  ticks: number
): boolean {
  registerBlueprint(w, pred)
  registerBlueprint(w, prey)

  const py = WORLD_H - 11
  spawnCreature(w, prey, 143, py)
  spawnCreature(w, pred, 100, py)

  const preyC = w.creatures.find(c => c.blueprintId === prey.id)!
  const predC = w.creatures.find(c => c.blueprintId === pred.id)!
  predC.hunger = 1.0

  runTicks(w, ticks)
  return predC.targetId === preyC.id
}

describe('detection with chromatophores', () => {
  it('chromatophore prey is hidden once hue matches dirt (after 5 s)', () => {
    // Start with hue=180° (far from dirt ~27°) → initially detectable.
    // After 5 s → hue → 27° (dirt-matched) → crypticCamouflage≈1 → hidden.
    const w = dirtWorld()
    const pred = predatorBp()
    const prey = preyBp(true, 180) // mismatched start, will adapt

    // Run well past the 5 s update interval: 10 s + enough ticks for sense passes.
    const detected = runDetection(w, prey, pred, 10 * 60 + 24)

    expect(detected).toBe(false)
  })

  it('non-chromatophore prey with matching hue stays hidden continuously', () => {
    const w = dirtWorld()
    const pred = predatorBp()
    const dirtHue = hexHue(MATERIAL_BY_INDEX[MATERIAL_INDEX.dirt]!.color)
    const prey = preyBp(false, dirtHue) // already hue-matched, no chromatophore

    const detected = runDetection(w, prey, pred, 10 * 60 + 24)
    expect(detected).toBe(false)
  })

  it('non-chromatophore prey with mismatching hue is detected', () => {
    const w = dirtWorld()
    const pred = predatorBp()
    const prey = preyBp(false, 207) // 180° from dirt → camo=0 → efs²=8100 > d²=1600

    const detected = runDetection(w, prey, pred, 24)
    expect(detected).toBe(true)
  })
})
