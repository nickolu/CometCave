/**
 * Lateral line hydrodynamic sensing.
 *
 * A creature with lateralLine: true detects nearby creatures within
 * LATERAL_LINE_RADIUS=5 tiles regardless of camouflage — but ONLY when
 * standing on a water or mud tile.
 *
 * Test geometry:
 *   predator at x=100, art width=3 ('aaa' padded to 3×3 by ART_MIN)
 *   prey at x=107, art width=3 → edge gap = 107-103 = 4 tiles, d² = 16
 *
 * Prey has traits.camouflage=0.99 (not cryptic — independent of tile hue):
 *   detFactor(still, camo=0.99) = max(0.15, 0.5-0.99×0.375) = 0.15
 *   With sight=5, hunger=1, roam=1.3: foodSight=5×(1+2×1×1.3)=18, foodSight²=324
 *   efs²(normal) = 324 × 0.15² = 7.29 → d²=16 > 7.29 → NOT detected
 *   efs²(bypass) = 324 × 0.5²  = 81   → d²=16 < 81  → DETECTED
 *
 * World tile determines whether lateral line fires:
 *   mud  → lateral line active (d²=16 < LATERAL_LINE_RADIUS²=25) → prey detected
 *   dirt → lateral line inactive → prey hidden (camo=0.99, d²>efs²)
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import {
  createWorld,
  registerBlueprint,
  spawnCreature,
} from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

function worldWithTile(tileId: 'dirt' | 'mud'): WorldState {
  const w = createWorld(42)
  const idx = MATERIAL_INDEX[tileId]
  for (let y = WORLD_H - 8; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = idx
  }
  w.dormant = true
  w.elapsed = 1
  return w
}

// Predator: sight=5, speed=0 (stationary — prevents wandering into detection range).
// hunger=1, roam=1.3 (meat-eater default from spawnCreature).
// foodSight = 5 × (1 + 2 × 1 × 1.3) = 18, foodSight² = 324.
// With camo=0 (bypass): efs² = 324 × 0.25 = 81 → detects prey at d²=16.
// With camo=0.99 (no bypass): efs² = 324 × 0.15² = 7.29 → misses prey at d²=16.
// speed=0 is critical: a mobile predator can wander within 2-3 tiles in 24 ticks,
// bringing d² below efs²(camo=0.99)=7.29 and causing a spurious detection.
function predBp(lateralLine: boolean): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: lateralLine ? 'FishPred' : 'NormalPred',
      tags: ['predator'],
      art: { palette: { a: '#0000ff' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 }, // stationary — test the sense logic, not movement
      diet: { eats: ['meat'], hungerRate: 0.01, lifespanSeconds: 900 },
      senses: { sight: 5 },
      lateralLine,
    },
    { summoned: true }
  )
}

// Prey: high trait camouflage (0.99) — independent of tile hue so it works on
// any floor. d²=16 > efs²(camo=0.99)=7.29 → invisible to normal predator.
function camouPrey(): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'HiddenPrey',
      tags: ['meat'],
      art: { palette: { a: '#888888' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 1 },
      traitDefaults: { camouflage: 0.99 },
    },
    { summoned: true }
  )
}

function checkDetection(
  pred: CreatureBlueprint,
  prey: CreatureBlueprint,
  tileId: 'dirt' | 'mud'
): boolean {
  const w = worldWithTile(tileId)
  registerBlueprint(w, pred)
  registerBlueprint(w, prey)

  const py = WORLD_H - 11
  // Prey at x=107: right edge of pred body (100+3=103) to left edge of prey body (107) = 4-tile gap.
  // d² = 4² = 16. LATERAL_LINE_RADIUS=5, radius²=25. 16 < 25 → lateral line fires.
  spawnCreature(w, prey, 107, py)
  spawnCreature(w, pred, 100, py)

  const preyC = w.creatures.find(c => c.blueprintId === prey.id)!
  const predC = w.creatures.find(c => c.blueprintId === pred.id)!
  predC.hunger = 1.0

  const rng = makeRng(42)
  for (let i = 0; i < 24; i++) tickCreatures(w, 1 / 60, rng, 1, [])
  return predC.targetId === preyC.id
}

// ---------------------------------------------------------------------------
// Blueprint sanitization tests
// ---------------------------------------------------------------------------

describe('lateralLine — sanitizeBlueprint', () => {
  const base = {
    name: 'Fish',
    tags: ['predator'] as const,
    art: { palette: { a: '#0000ff' }, frames: [['aaa']], frameMs: 200, faceMotion: false },
    move: { kind: 'walk' as const, speed: 0 },
    diet: { eats: ['meat'] as const, hungerRate: 0, lifespanSeconds: 900 },
    senses: { sight: 4 },
  }

  it('defaults to false', () => {
    expect(sanitizeBlueprint(base, { summoned: true }).lateralLine).toBe(false)
  })

  it('preserved when true', () => {
    expect(
      sanitizeBlueprint({ ...base, lateralLine: true }, { summoned: true }).lateralLine
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Simulation detection tests
// ---------------------------------------------------------------------------

describe('lateralLine — detection', () => {
  it('lateral-line predator in mud detects high-camo prey at 4-tile gap that normal predator cannot', () => {
    const fishPred = predBp(true)
    const normalPred = predBp(false)
    const prey = camouPrey()

    // camo=0.99 (tile-independent) → efs²=7.29, d²=16 > 7.29 → normal pred misses
    // lateral line on mud → sensorBypass → camo=0 → efs²=81, d²=16 < 81 → fish detects
    const normalDetects = checkDetection(normalPred, prey, 'mud')
    const fishDetects = checkDetection(fishPred, prey, 'mud')

    expect(normalDetects).toBe(false) // camo=0.99 prey outside normal efs²=7.29, d²=16
    expect(fishDetects).toBe(true) // lateral line bypasses camouflage in mud
  })

  it('lateral-line predator on DIRT does NOT detect the same prey (needs water/mud medium)', () => {
    const fishPred = predBp(true)
    const prey = camouPrey()
    // On dirt: lateral line inactive → camo=0.99 → efs²=7.29, d²=16 > 7.29 → NOT detected.
    const fishDetectsOnDirt = checkDetection(fishPred, prey, 'dirt')
    expect(fishDetectsOnDirt).toBe(false)
  })
})
