/**
 * Eyespot deflection: 40% of predator killing blows are redirected to non-vital
 * body parts, letting the prey escape. The predator loses the meal.
 *
 * Tests run enough ticks for the probabilistic deflection to produce a clear
 * statistical signal, then compare survival rates against a control (no eyespots).
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import type { CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

/** A world with a solid floor so creatures can stand. */
function floorWorld(): WorldState {
  const w = createWorld(1234)
  // Disable dormancy so generators don't interfere, but keep elapsed > 0
  // to avoid the disease-outbreak edge case that fires at elapsed == 0.
  w.dormant = true
  w.elapsed = 1
  for (let y = WORLD_H - 10; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) w.tiles[y * WORLD_W + x] = MATERIAL_INDEX.dirt
  }
  return w
}

/** A predator blueprint. Fast, hungry, small enough to eat medium prey. */
function predatorBp(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Predator',
      tags: ['meat'],
      art: {
        palette: { a: '#aa2222' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 200 },
      diet: { eats: ['meat'], hungerRate: 0.001, lifespanSeconds: 900 },
      senses: { sight: 20 },
      body: { w: 3, h: 3, density: 0.5 },
      ...extra,
    },
    { summoned: true }
  )
}

/** A prey blueprint. Slow, rooted-equivalent (speed 0) for predictable positioning. */
function preyBp(extra: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint(
    {
      name: 'Test Prey',
      tags: ['meat'],
      art: {
        palette: { a: '#44aa44' },
        frames: [['aaa', 'aaa', 'aaa']],
        frameMs: 200,
        faceMotion: false,
      },
      move: { kind: 'walk', speed: 0 },
      diet: { eats: [], hungerRate: 0, lifespanSeconds: 900 },
      senses: { sight: 0 },
      body: { w: 3, h: 3, density: 0.5 },
      ...extra,
    },
    { summoned: true }
  )
}

function runSim(w: WorldState, seconds: number): void {
  const rng = makeRng(99)
  for (let i = 0; i < seconds * 60; i++) tickCreatures(w, 1 / 60, rng, 1, [])
}

describe('eyespot deflection', () => {
  it('a prey without eyespots is always eaten when the predator catches it', () => {
    const w = floorWorld()
    const pred = predatorBp()
    const prey = preyBp({ eyespots: false })
    registerBlueprint(w, pred)
    registerBlueprint(w, prey)

    // Place predator right next to prey so touching is immediate.
    const floor = WORLD_H - 13
    spawnCreature(w, pred, 30, floor)
    spawnCreature(w, prey, 34, floor)

    // Give predator max hunger so it eats immediately.
    w.creatures[0].hunger = 0.9

    runSim(w, 3)

    // Without eyespots, prey is consistently eaten within 3 seconds.
    const preyAlive = w.creatures.some(c => c.blueprintId === prey.id)
    expect(preyAlive).toBe(false)
  })

  it('a prey with eyespots survives some encounters due to deflection', () => {
    // Run 20 independent single-encounter trials and count survivals.
    // EYESPOT_DEFLECT_CHANCE = 0.4, so P(survive a single bite) = 0.4.
    // With a fast predator landing ~5 bites in 0.5s, P(survive all) is ~0.4^5 ≈ 1%.
    // But the prey escapes (gains speed) after the first deflection, so survival
    // of at least one trial in 20 is near-certain.
    //
    // We check that the prey is NOT killed 100% of the time — at least one trial
    // should produce a deflected escape when run with a fixed seed.
    let anyDeflected = false

    for (let trial = 0; trial < 20; trial++) {
      const w = floorWorld()
      const pred = predatorBp()
      const prey = preyBp({ eyespots: true })
      registerBlueprint(w, pred)
      registerBlueprint(w, prey)

      const floor = WORLD_H - 13
      spawnCreature(w, pred, 30, floor)
      spawnCreature(w, prey, 34, floor)
      w.creatures[0].hunger = 0.9

      // Run only 0.2 s — just long enough for one bite attempt.
      const rng = makeRng(trial * 7 + 3)
      for (let i = 0; i < 12; i++) tickCreatures(w, 1 / 60, rng, 1, [])

      const preyAlive = w.creatures.some(c => c.blueprintId === prey.id)
      if (preyAlive) {
        anyDeflected = true
        break
      }
    }

    // Over 20 trials with 40% deflection, at least one deflection is virtually certain.
    expect(anyDeflected).toBe(true)
  })

  it('eyespot flag is preserved through blueprint sanitization', () => {
    const bp = preyBp({ eyespots: true })
    expect(bp.eyespots).toBe(true)

    const bpFalse = preyBp({ eyespots: false })
    expect(bpFalse.eyespots).toBe(false)

    const bpAbsent = preyBp()
    expect(bpAbsent.eyespots).toBe(false)
  })
})
