/**
 * The primary metric, and the two ways it would quietly mislead.
 *
 * `T_ext` — median world-second at which the meadow first loses an animal — is
 * what the stability work is optimised against, because every check in
 * `evals.ts` is binary and therefore stuck reporting "still failing" on both
 * arms of any experiment run while the world is broken. A metric nobody can
 * disprove is worse than no metric, so the two decisions inside it are pinned
 * here rather than left to a comment.
 *
 * **Censoring.** A run where nothing died reports the run length, flagged. Drop
 * those runs instead and a change that saved a world would make the number go
 * *down*: the rescued runs leave the sample and only the failures get averaged.
 *
 * **Who counts as an animal.** `isPlantLike`, not `move.kind === 'root'`. The
 * grassland contains a flower that flies.
 */
import { describe, expect, it } from 'vitest'

import { textMetric } from '@/app/micro-land/harness/evals'
import { firstAnimalExtinction } from '@/app/micro-land/harness/run'
import type { RunMetrics } from '@/app/micro-land/harness/run'

function metrics(over: Partial<RunMetrics>): RunMetrics {
  return {
    themeId: 'grassland',
    seed: 1000,
    seconds: 1600,
    survivors: {},
    seeded: [],
    animals: [],
    extinctions: [],
    extinctionSecond: {},
    population: [],
    peak: 0,
    lowWater: 0,
    alive: 0,
    deaths: {},
    meals: {},
    births: {},
    solidFraction: 0.3,
    drift: {},
    probe: { species: {}, lastMood: new Map() },
    maturityAge: {},
    ...over,
  }
}

describe('firstAnimalExtinction', () => {
  it('reports the earliest animal to hit zero, and which one it was', () => {
    const r = metrics({
      animals: ['hopper', 'stalker'],
      extinctionSecond: { hopper: 900, stalker: 420 },
    })

    expect(firstAnimalExtinction(r)).toEqual({ second: 420, censored: false, species: 'stalker' })
  })

  it('censors at the run length when nothing died', () => {
    const r = metrics({ animals: ['hopper'], seconds: 1600 })

    expect(firstAnimalExtinction(r)).toEqual({ second: 1600, censored: true, species: null })
  })

  it('ignores a plant that died, however early', () => {
    // The seed bank pulls flora back from zero on purpose (invariant 7), so a
    // plant hitting zero is a thing the world recovers from by design. Counting
    // it would make `T_ext` a measurement of the plant cycle.
    const r = metrics({
      seeded: ['hopper', 'sunleaf'],
      animals: ['hopper'],
      extinctionSecond: { sunleaf: 40 },
    })

    expect(firstAnimalExtinction(r).censored).toBe(true)
  })
})

describe('textMetric', () => {
  it('takes the median across runs, not the mean', () => {
    // One world in which the founders spawn somewhere lethal should not sink a
    // set, and one lucky world should not carry it.
    const t = textMetric([
      metrics({ seed: 1, animals: ['a'], extinctionSecond: { a: 100 } }),
      metrics({ seed: 2, animals: ['a'], extinctionSecond: { a: 800 } }),
      metrics({ seed: 3, animals: ['a'], extinctionSecond: { a: 900 } }),
    ])

    expect(t.median).toBe(800)
    expect(t.censored).toBe(false)
  })

  it('marks the median censored when half the runs never lost anything', () => {
    const t = textMetric([
      metrics({ seed: 1, animals: ['a'], extinctionSecond: { a: 100 } }),
      metrics({ seed: 2, animals: ['a'] }),
      metrics({ seed: 3, animals: ['a'] }),
    ])

    expect(t.median).toBe(1600)
    expect(t.censored).toBe(true)
  })
})
