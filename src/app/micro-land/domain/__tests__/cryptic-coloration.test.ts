/**
 * Cryptic coloration — hue-matched camouflage.
 *
 * Cryptic creatures get a camouflage bonus when their `traits.hue` matches the
 * tile they're standing on. The effective camouflage is
 * `max(traits.camouflage, crypticCamouflage(creatureHue, tileHue))`.
 *
 * Tests cover:
 *   1. `hexHue` — correct hue extraction and achromatic detection.
 *   2. `crypticCamouflage` — score at 0°/45°/90° offset and achromatic tile.
 *   3. Integration: `cryptic: true` flag is preserved by sanitizeBlueprint and
 *      the full hue→tile chain produces the expected camouflage score.
 *   4. Integration: non-cryptic creatures get no tile bonus.
 *   5. Integration: a creature on a dirt tile achieves high camouflage only when
 *      its hue matches dirt and cryptic=true.
 *   6. Sim: after a few sense passes, a predator has locked onto a mismatching-hue
 *      prey (high efs²) but not a matching-hue one (low efs²), proving that the
 *      cryptic flag shrinks the effective detection radius.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_BY_INDEX, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { crypticCamouflage, hexHue, tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import {
  createWorld,
  registerBlueprint,
  spawnCreature,
  tileAt,
} from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// 1. hexHue unit tests
// ---------------------------------------------------------------------------

describe('hexHue', () => {
  it('returns -1 for achromatic colours (gray, black, white)', () => {
    expect(hexHue('#808080')).toBe(-1)
    expect(hexHue('#000000')).toBe(-1)
    expect(hexHue('#ffffff')).toBe(-1)
  })

  it('returns ~0° for red', () => {
    const h = hexHue('#ff0000')
    expect(h).toBeCloseTo(0, 0)
  })

  it('returns ~120° for green', () => {
    expect(hexHue('#00ff00')).toBeCloseTo(120, 0)
  })

  it('returns ~240° for blue', () => {
    expect(hexHue('#0000ff')).toBeCloseTo(240, 0)
  })

  it('returns ~27° for dirt (#6b4a2f)', () => {
    expect(hexHue('#6b4a2f')).toBeCloseTo(27, 0)
  })
})

// ---------------------------------------------------------------------------
// 2. crypticCamouflage unit tests
// ---------------------------------------------------------------------------

describe('crypticCamouflage', () => {
  it('returns 1 when creature hue matches tile hue exactly', () => {
    expect(crypticCamouflage(27, 27)).toBe(1)
    expect(crypticCamouflage(180, 180)).toBe(1)
  })

  it('returns 0 when creature hue is 90° or more away from tile hue', () => {
    expect(crypticCamouflage(27, 27 + 90)).toBe(0)
    expect(crypticCamouflage(27, 27 + 180)).toBe(0)
    expect(crypticCamouflage(27, 27 + 270)).toBe(0)
  })

  it('returns 0.5 at 45° offset', () => {
    expect(crypticCamouflage(0, 45)).toBeCloseTo(0.5, 5)
  })

  it('returns 0.3 for achromatic tiles (tileHue=-1)', () => {
    expect(crypticCamouflage(27, -1)).toBe(0.3)
    expect(crypticCamouflage(0, -1)).toBe(0.3)
  })

  it('wraps correctly across the 0°/360° boundary', () => {
    // 350° and 10° are 20° apart — not 340° apart.
    expect(crypticCamouflage(350, 10)).toBeCloseTo(1 - 20 / 90, 5)
  })
})

// ---------------------------------------------------------------------------
// 3–5. Integration: blueprint flag + tile chain
// ---------------------------------------------------------------------------

describe('cryptic coloration — blueprint and tile chain', () => {
  it('sanitizeBlueprint preserves cryptic: true', () => {
    const bp = sanitizeBlueprint(
      {
        name: 'Test',
        tags: ['meat'],
        art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        cryptic: true,
      },
      { summoned: true }
    )
    expect(bp.cryptic).toBe(true)
  })

  it('sanitizeBlueprint rejects cryptic: false (keeps false)', () => {
    const bp = sanitizeBlueprint(
      {
        name: 'Test',
        tags: ['meat'],
        art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        cryptic: false,
      },
      { summoned: true }
    )
    expect(bp.cryptic).toBe(false)
  })

  it('dirt tile has the expected hue (~27°)', () => {
    const w = createWorld(1)
    for (let y = WORLD_H - 4; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
    }
    const dirtMat = MATERIAL_BY_INDEX[tileAt(w, 40, WORLD_H - 2)]
    expect(dirtMat?.id).toBe('dirt')
    expect(hexHue(dirtMat!.color)).toBeCloseTo(27, 0)
  })

  it('cryptic creature with matching hue on dirt gets score ≈ 1', () => {
    // Demonstrate the full chain:
    // creature.traits.hue ≈ 27° (matches dirt) → crypticCamouflage ≈ 1
    const dirtHue = hexHue(MATERIAL_BY_INDEX[MATERIAL_INDEX.dirt]!.color)
    const score = crypticCamouflage(27, dirtHue)
    expect(score).toBeCloseTo(1, 1) // within 0.05 of 1
  })

  it('cryptic creature with mismatching hue on dirt gets score ≈ 0', () => {
    const dirtHue = hexHue(MATERIAL_BY_INDEX[MATERIAL_INDEX.dirt]!.color) // ~27°
    // 207° = 27° + 180° → 180° apart → score = 0
    const score = crypticCamouflage(207, dirtHue)
    expect(score).toBe(0)
  })

  it('non-cryptic creature gets no tile bonus — max(traitCamo, 0) regardless of hue', () => {
    // A non-cryptic creature's effective camouflage = traits.camouflage only.
    // We can verify the math: if cryptic=false, the code path is `other.traits.camouflage`,
    // which is `traitDefaults.camouflage=0`. No tile-hue bonus applies.
    //
    // This is implied by the tests above, but stated explicitly:
    // For any tile, crypticCamouflage(x, y) can be as high as 1 — but only
    // applied when obp.cryptic is true.
    const dirtHue = hexHue(MATERIAL_BY_INDEX[MATERIAL_INDEX.dirt]!.color)
    // With matching hue, tile gives 1.0. But without cryptic, 0 is used.
    // Non-cryptic effective camouflage = traits.camouflage = 0 (our test default).
    expect(crypticCamouflage(27, dirtHue)).toBe(1.0) // math alone is 1
    // The flag `cryptic=false` means this 1.0 is NOT used. Verified by the sim test below.
  })
})

// ---------------------------------------------------------------------------
// 6. Simulation test: does the detection radius actually shrink?
//
// Setup:
//   - World: flat dirt floor (WORLD_H-8 to WORLD_H-1).
//   - Both art frames are padded to ART_MIN=3 rows → body.h = body.w = 3.
//   - Predator: x=100, sight=60. At desperation=1 (hunger=1):
//       foodSight = 60 × (1 + 2×1) = 180. foodSight² = 32400.
//       detFactor(still, camo=0) = 0.5 → efs² = 32400 × 0.25 = 8100
//       detFactor(still, camo≈1) = 0.15 → efs² = 32400 × 0.0225 = 729
//   - Prey: x=143. Edge-to-edge gap = 143 − (100+3) = 40 tiles. d² = 1600.
//       1600 < 8100 (camo=0) → detected.
//       1600 > 729  (camo≈1) → NOT detected.
//   - Test strategy: run 24 ticks (4 sense passes) and check predator.targetId.
//     A detected prey causes targetId=preyId; a hidden prey leaves targetId=null.
//     This directly tests the detection mechanism rather than relying on the
//     predator physically reaching and eating the prey.
// ---------------------------------------------------------------------------

function dirtWorldForSim(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  // Start elapsed at 1 s to avoid the "disease outbreak every 180 s" trigger
  // that fires when floor(elapsed/180) > floor((elapsed-dt)/180). At elapsed=0
  // that evaluates to floor(0) > floor(-dt) = 0 > -1 = true, infecting a
  // random creature on the very first tick and slowing it by 30%.
  w.elapsed = 1
  return w
}

function predatorBp(): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'SimPredator',
      tags: ['predator'],
      art: {
        palette: { a: '#ff0000' },
        frames: [['aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 16 },
      diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
      senses: { sight: 60 },
    },
    { summoned: true }
  )
}

function preyCreatureBp(hue: number, cryptic: boolean): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'SimPrey',
      tags: ['meat'],
      art: {
        palette: { a: '#888888' },
        frames: [['aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 1 },
      cryptic,
      traitDefaults: { hue, camouflage: 0 },
    },
    { summoned: true }
  )
}

/**
 * Run enough ticks for at least one sense pass, then check whether the
 * predator has locked onto the prey.
 *
 * Detection, not survival, is the mechanic under test. Camouflage changes
 * efs² (effective sight²), so a high-camo prey at d²=1600 is invisible at
 * efs²=729 but detectable at efs²=8100. Testing detection after a handful
 * of sense passes avoids the race between the predator reaching the prey
 * and the sense pass firing, which makes survival counts brittle.
 *
 * Gap: both creatures share x-row; predator at x=100, prey at x=143.
 * Body width=3 (padded to ART_MIN=3). Edge-to-edge gap = 143-103 = 40 tiles.
 * d² = 40² = 1600.
 *   mismatch (camo=0): efs²=8100 → 1600<8100 → detected
 *   match    (camo≈1): efs²=729  → 1600>729  → NOT detected
 */
function simCheckDetection(prey: CreatureBlueprint): boolean {
  const w = dirtWorldForSim()
  const pred = predatorBp()

  registerBlueprint(w, pred)
  registerBlueprint(w, prey)

  // Art frames are padded to ART_MIN=3 rows by sanitizeBlueprint, so the
  // actual body height is 3. Spawn above the floor (which starts at WORLD_H-8)
  // by exactly body.h rows so the creatures settle on top of the floor tile
  // rather than being embedded inside it.
  // floor_top = WORLD_H - 8 = 124; body_h = 3; spawn_y = 124 - 3 = 121 = WORLD_H - 11.
  const py = WORLD_H - 11
  spawnCreature(w, prey, 143, py) // prey 40 edge-to-edge right of pred
  spawnCreature(w, pred, 100, py)

  const preyC = w.creatures.find(c => c.blueprintId === prey.id)!
  const predC = w.creatures.find(c => c.blueprintId === pred.id)!
  predC.hunger = 1.0

  // Run 24 ticks (= 4 × SENSE_EVERY=6) to ensure at least one sense pass
  // fires for the predator. The disease outbreak at elapsed=0 is avoided by
  // dirtWorldForSim() setting w.elapsed=1.
  const rng = makeRng(42)
  for (let i = 0; i < 24; i++) tickCreatures(w, 1 / 60, rng, 1, [])

  // Predator has locked onto prey ↔ prey was detected.
  return predC.targetId === preyC.id
}

describe('cryptic coloration — simulation', () => {
  it('predator detects mismatching-hue prey but not matching-hue prey on dirt', () => {
    // Mismatching: hue=207 (180° from dirt's ~27°) → crypticCamouflage score=0
    //   → effective camouflage=0 → detFactor=0.5 → efs²=8100 > d²=1600 → detected.
    const mismatchDetected = simCheckDetection(preyCreatureBp(207, true))

    // Matching: hue=27 (exact dirt hue) → crypticCamouflage score≈1
    //   → effective camouflage≈1 → detFactor=0.15 → efs²=729 < d²=1600 → NOT detected.
    const matchDetected = simCheckDetection(preyCreatureBp(27, true))

    expect(mismatchDetected).toBe(true) // mismatching prey detected by predator
    expect(matchDetected).toBe(false) // matching prey hidden by cryptic coloration
  })

  it('non-cryptic creature with matching hue is detected regardless of tile hue', () => {
    // cryptic=false → no tile bonus → camouflage=0.2 (default trait)
    //   → detFactor=max(0.15, 0.5−0.2×0.375)=0.425 → efs²≈5852 > d²=1600 → detected.
    const nonCrypticDetected = simCheckDetection(preyCreatureBp(27, false))
    expect(nonCrypticDetected).toBe(true)
  })
})
