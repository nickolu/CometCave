/**
 * Disruptive coloration — high-contrast stripe/spot patterns that break the
 * creature's apparent outline at range.
 *
 * At distances beyond DISRUPTION_NEAR_TILES (4), a predator can only detect
 * disruptive-pattern prey at DISRUPTION_FAR_FACTOR (0.65) of its normal
 * effective detection radius. Up close (< 4 tiles), the body is obvious and
 * the pattern gives no benefit.
 *
 * Test setup math (predator: sight=10, hunger=1.0, roam=1, prey: still, camouflage=0):
 *   desperation = clamp((1.0 - 0.3) / 0.6, 0, 1) = 1.0
 *   foodSight   = 10 × (1 + 2 × 1 × 1) = 30     (HUNGER_REACH=2)
 *   detFactor   = 0.5                              (still, camo=0)
 *   efs²        = 900 × 0.25 = 225  →  efs = 15 tiles
 *   finalEfs²   = 225 × 0.65² = 95.06  →  finalEfs ≈ 9.75 tiles (with disruption)
 *
 * Body width = ART_MIN = 3 on each side. gapX = |dx_centre| − (3+3)/2.
 *   predator at x=0, prey at x=P  →  gapX = P − 3.
 *   gapX=12 → P=15: d²=144. 144 > 95.06 → NOT detected with disruption; 144 < 225 → detected without.
 *   gapX=7  → P=10: d²=49.  49  < 95.06 → detected even with disruption.
 *   gapX=3  → P=6:  d²=9.   9   < 16 (DISRUPTION_NEAR²) → disruption suppressed; 9 < 225 → detected.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dirtWorld(): WorldState {
  const w = createWorld(1234)
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  w.dormant = true
  // Avoid the elapsed=0 disease-outbreak trigger (floor(0/180) > floor(-dt/180)).
  w.elapsed = 1
  return w
}

function predatorBp(): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'DisruptPredator',
      tags: ['predator'],
      art: {
        palette: { a: '#ff0000' },
        frames: [['aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      // speed: 0 keeps the predator stationary so it can't close the gap
      // between ticks or eat the prey — we are testing detection, not pursuit.
      move: { kind: 'walk', speed: 0 },
      diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
      senses: { sight: 10 },
    },
    { summoned: true }
  )
}

function preyBp(disruptivePattern: boolean): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: disruptivePattern ? 'DisruptPrey' : 'PlainPrey',
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
      disruptivePattern,
      traitDefaults: { camouflage: 0 },
    },
    { summoned: true }
  )
}

/**
 * Place the predator at x=0, prey at x=preyX, both on the dirt floor.
 * Run 24 ticks (= 4 sense passes) and return whether the predator locked onto the prey.
 *
 * Body width = ART_MIN = 3. Edge-to-edge gap = preyX − 3.
 */
function checkDetection(prey: CreatureBlueprint, preyX: number): boolean {
  const w = dirtWorld()
  const pred = predatorBp()

  registerBlueprint(w, pred)
  registerBlueprint(w, prey)

  // floor_top = WORLD_H − 8. body_h = ART_MIN = 3. Spawn at WORLD_H − 11.
  const py = WORLD_H - 11
  spawnCreature(w, pred, 0, py)
  spawnCreature(w, prey, preyX, py)

  const preyC = w.creatures.find(c => c.blueprintId === prey.id)!
  const predC = w.creatures.find(c => c.blueprintId === pred.id)!
  predC.hunger = 1.0

  const rng = makeRng(42)
  for (let i = 0; i < 24; i++) tickCreatures(w, 1 / 60, rng, 1, [])

  return predC.targetId === preyC.id
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('disruptive coloration — simulation', () => {
  /**
   * gapX=12, d²=144. DISRUPTION_NEAR²=16. 144>16 → disruption active.
   * finalEfs²≈95.06. 144>95.06 → NOT detected with disruption.
   * Without disruption: efs²=225 > 144 → detected.
   */
  it('disruptive prey at 12-tile gap is not detected by a predator that would otherwise see at 15', () => {
    // Verify plain prey IS detected at this distance (control)
    const plainDetected = checkDetection(preyBp(false), 15)
    expect(plainDetected).toBe(true)

    // Disruptive prey at the same distance is hidden
    const disruptiveDetected = checkDetection(preyBp(true), 15)
    expect(disruptiveDetected).toBe(false)
  })

  /**
   * gapX=7, d²=49. DISRUPTION_NEAR²=16. 49>16 → disruption active.
   * finalEfs²≈95.06. 49<95.06 → detected even with disruption.
   */
  it('disruptive prey at 7-tile gap is detected (within 65% of effective detection range)', () => {
    const detected = checkDetection(preyBp(true), 10)
    expect(detected).toBe(true)
  })

  /**
   * gapX=3, d²=9. DISRUPTION_NEAR²=16. 9<16 → disruption suppressed (close range).
   * efs²=225. 9<225 → detected regardless of disruptivePattern.
   */
  it('disruptive prey at 3-tile gap is always detected (within DISRUPTION_NEAR_TILES)', () => {
    const detected = checkDetection(preyBp(true), 6)
    expect(detected).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Blueprint sanitization
// ---------------------------------------------------------------------------

describe('disruptive coloration — sanitizeBlueprint', () => {
  it('preserves disruptivePattern: true', () => {
    const bp = sanitizeBlueprint(
      {
        name: 'Test',
        tags: ['meat'],
        art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        disruptivePattern: true,
      },
      { summoned: true }
    )
    expect(bp.disruptivePattern).toBe(true)
  })

  it('sanitizes disruptivePattern: false to false', () => {
    const bp = sanitizeBlueprint(
      {
        name: 'Test',
        tags: ['meat'],
        art: { palette: { a: '#ff0000' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
        move: { kind: 'walk', speed: 0 },
        diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
        senses: { sight: 1 },
        disruptivePattern: false,
      },
      { summoned: true }
    )
    expect(bp.disruptivePattern).toBe(false)
  })
})
