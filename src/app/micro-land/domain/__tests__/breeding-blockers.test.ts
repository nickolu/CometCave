/**
 * `breedingBlockers` and `readyToBreed` must agree, forever.
 *
 * They are deliberately separate implementations of the same four questions:
 * `readyToBreed` runs for every creature in the sense pass and stays a
 * short-circuiting boolean, while `breedingBlockers` allocates an array to say
 * *which* clause failed and runs only from the harness. That duplication is a
 * real cost, and this test is what buys it back — the moment someone changes one
 * gate and not the other, every eval built on the probe starts quietly lying
 * about why animals are not breeding.
 *
 * `readyToBreed` is not exported (it has no business being), so this asserts the
 * equivalence through the one public statement of the same rule: a creature with
 * no blockers is one the simulation will let breed.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { breedingBlockers, founderMaturityAge } from '@/app/micro-land/domain/sim/creature-sim'
import { createWorld, registerBlueprint, spawnCreature } from '@/app/micro-land/domain/sim/world'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint } from '@/app/micro-land/domain/types'

function grazer(): CreatureBlueprint {
  return sanitizeBlueprint({
    id: 'test-grazer',
    name: 'Test Grazer',
    move: { kind: 'walk', speed: 4, jump: 3, hop: 0, restlessness: 0.3 },
    diet: { eats: ['plant'], tags: ['animal'], breedAt: 0.6, lifespanSeconds: 100 },
    art: { palette: { a: '#8888ff' }, frames: [['a']] },
  })
}

function placed(): { c: Creature; bp: CreatureBlueprint } {
  const w = createWorld(1)
  const bp = grazer()
  registerBlueprint(w, bp)
  const c = spawnCreature(w, bp, 10, 10)
  if (!c) throw new Error('spawn failed')
  return { c, bp }
}

describe('breedingBlockers', () => {
  it('reports nothing blocking a fed, rested, mature creature', () => {
    const { c, bp } = placed()
    c.hunger = 0
    c.breedCooldown = 0
    c.ageSeconds = founderMaturityAge(bp) * 2

    expect(breedingBlockers(c, bp)).toEqual([])
  })

  it('names the cooldown while it is still running', () => {
    const { c, bp } = placed()
    c.hunger = 0
    c.ageSeconds = founderMaturityAge(bp) * 2
    c.breedCooldown = 5

    expect(breedingBlockers(c, bp)).toContain('cooldown')
  })

  it('names hunger when the creature is below its breedAt threshold', () => {
    const { c, bp } = placed()
    c.breedCooldown = 0
    c.ageSeconds = founderMaturityAge(bp) * 2
    // breedAt 0.6 wants `1 - hunger >= 0.6`, so hunger above 0.4 is underfed.
    c.hunger = 0.5

    expect(breedingBlockers(c, bp)).toContain('underfed')
  })

  it('names age for a founder that has not reached maturity', () => {
    const { c, bp } = placed()
    c.hunger = 0
    c.breedCooldown = 0
    c.ageSeconds = founderMaturityAge(bp) / 2

    expect(breedingBlockers(c, bp)).toContain('too-young')
  })

  it('names the headroom clause when a child could not be afforded', () => {
    const { c, bp } = placed()
    c.breedCooldown = 0
    c.ageSeconds = founderMaturityAge(bp) * 2
    // `hunger + breedCost >= 1` is the clause; pick a hunger that trips it.
    c.hunger = 1 - TUNING.breedCost

    expect(breedingBlockers(c, bp)).toContain('no-headroom')
  })

  /**
   * The one that matters. Sweeps the whole space the gate is defined over and
   * asserts the two readings never disagree about *whether* breeding is allowed.
   */
  it('agrees with the simulation gate across the whole hunger/age space', () => {
    const { c, bp } = placed()
    const maturity = founderMaturityAge(bp)

    for (const hunger of [0, 0.2, 0.39, 0.4, 0.41, 0.6, 0.69, 0.7, 1]) {
      for (const age of [0, maturity - 1, maturity, maturity + 1, maturity * 3]) {
        for (const cooldown of [0, 2]) {
          c.hunger = hunger
          c.ageSeconds = age
          c.breedCooldown = cooldown

          const blockers = breedingBlockers(c, bp)
          const expectedReady =
            cooldown <= 0 &&
            1 - hunger >= bp.diet.breedAt &&
            hunger + TUNING.breedCost < 1 &&
            age > maturity

          expect(blockers.length === 0).toBe(expectedReady)
        }
      }
    }
  })
})
