/**
 * What "the world is alive" means, written down as things that can fail.
 *
 * The harness could already print a population table. What it could not do is
 * answer "did that change help", because answering it by eye across two tables
 * and different seeds is not answering it. Each check here is one claim about a
 * healthy world, with a number attached, so a run either holds the claim or
 * does not.
 *
 * Three rules for adding to this file.
 *
 * **A check must be able to fail for one reason.** `no-animal-extinctions` is a
 * good headline and a bad diagnostic: everything upstream of it makes it fail.
 * That is why the breeding checks below are split into gate → priority →
 * arrival, one per possible cause, in the order you would fix them.
 *
 * **Thresholds are floors, not targets.** They are set where the *current*
 * behaviour is unambiguously wrong, not where the ideal sits — a threshold that
 * fails on a merely-mediocre world gets muted, and a muted check is worse than
 * no check. Raise them when the floor is comfortably cleared.
 *
 * **Nothing here asserts on one seed.** Every check takes the whole set of runs
 * and reduces across them, because `Math.random()` is reachable from three
 * places in the sim (see `run.ts`) and one run is an anecdote.
 */
import type { BreedBlocker } from '@/app/micro-land/domain/sim/creature-sim'

import { type SpeciesProbe, meanProbe } from './breeding-probe'

import type { RunMetrics } from './run'

export interface EvalResult {
  id: string
  /** One line: what this measures. */
  what: string
  /** One line: what a failure means, in terms of where to look. */
  points_at: string
  pass: boolean
  /** The measured number, for trend-watching even when it passes. */
  value: number
  /** Human-readable form of the bar it had to clear. */
  bar: string
  /** Per-species or per-run breakdown, shown on failure. */
  detail?: string
}

export interface EvalCheck {
  id: string
  what: string
  points_at: string
  run(runs: RunMetrics[]): Omit<EvalResult, 'id' | 'what' | 'points_at'>
}

/** Animal species that were seeded into the world, across all runs. */
function animalIds(runs: RunMetrics[]): string[] {
  return [...new Set(runs.flatMap(r => Object.keys(r.probe.species)))]
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`
}

// ---------------------------------------------------------------------------
// Headline: is there still a world at the end of this?
// ---------------------------------------------------------------------------

const noAnimalExtinctions: EvalCheck = {
  id: 'no-animal-extinctions',
  what: 'Every animal species seeded at t=0 still has a living member at the end.',
  points_at: 'The whole chain. Read the breeding checks below before this one.',
  run(runs) {
    // Per species, the worst run. A species that survives four seeds and dies on
    // the fifth is not a healthy species, it is a lucky one.
    const animals = animalIds(runs)
    const gone = animals.filter(id => runs.some(r => r.extinctions.includes(id)))
    const survivalRate = animals.length ? 1 - gone.length / animals.length : 1
    return {
      pass: gone.length === 0,
      value: survivalRate,
      bar: 'no seeded animal species extinct in any run',
      detail: gone.length ? `extinct in ≥1 run: ${gone.join(', ')}` : undefined,
    }
  },
}

const populationOscillates: EvalCheck = {
  id: 'population-oscillates',
  what: 'The low-water mark stays well clear of zero — a cycle, not a slide.',
  points_at: 'Carrying capacity or a food chain that only runs one way.',
  run(runs) {
    // Against peak rather than an absolute count, so the check means the same
    // thing on a theme that seeds 190 creatures and one that seeds 40.
    const ratios = runs.map(r => (r.peak > 0 ? r.lowWater / r.peak : 0))
    const worst = Math.min(...ratios)
    return {
      pass: worst >= 0.35,
      value: worst,
      bar: 'low water ≥ 35% of peak, in every run',
      detail: runs.map(r => `seed ${r.seed}: ${r.lowWater}/${r.peak}`).join('  '),
    }
  },
}

// ---------------------------------------------------------------------------
// Breeding, in the order you would debug it. Gate → priority → arrival.
// ---------------------------------------------------------------------------

/**
 * The check that guards the other checks.
 *
 * Maturity is `lifespanSeconds * lifespanScale * 0.2`, and `lifespanScale` is
 * 10 — so a species with `lifespanSeconds: 150` cannot breed until t=300s, and
 * 300s was the harness's default run length. Every breeding number produced by
 * a run that short is measuring how much of a creature's childhood fits in the
 * window, and reporting it as infertility.
 *
 * This fails loudly rather than letting the breeding checks below report a
 * confident wrong answer. It is a check about the *experiment*, not the world.
 */
const runOutlastsMaturity: EvalCheck = {
  id: 'run-outlasts-maturity',
  what: 'The run is long enough that animals could have bred at all.',
  points_at: 'The harness, not the game — raise --seconds before believing the breeding checks.',
  run(runs) {
    const seconds = runs[0]?.seconds ?? 0
    const animals = new Set(animalIds(runs))
    const ages = runs
      .flatMap(r => Object.entries(r.maturityAge))
      .filter(([id]) => animals.has(id))
      .map(([, age]) => age)
    const slowest = ages.length ? Math.max(...ages) : 0
    // Twice maturity: a creature that matures on the final tick has had no time
    // to find a partner, and one generation is not a population.
    const needed = slowest * 2
    return {
      pass: slowest > 0 && seconds >= needed,
      value: needed > 0 ? seconds / needed : 0,
      bar: `run ≥ 2× the slowest animal's maturity (${needed.toFixed(0)}s; this run ${seconds}s)`,
      detail:
        seconds < needed
          ? `slowest maturity ${slowest.toFixed(0)}s — breeding checks below are not meaningful`
          : undefined,
    }
  },
}

/**
 * Upstream of everything else, and the reason it is listed first.
 *
 * Breeding is paid for out of a full stomach: `readyToBreed` wants
 * `1 - hunger >= breedAt` *and* enough headroom left to afford `breedCost`. So
 * an animal that cannot reach food cannot breed, and every downstream check
 * fails with it — while pointing at breeding, which is not where the bug is.
 * Measure eating before believing anything about mating.
 */
const foragingFeedsAnimals: EvalCheck = {
  id: 'foraging-feeds-animals',
  what: 'Animals that go hunting actually reach food and eat it.',
  points_at: 'Pathing/targeting in `look` and `steer` — hunting that never arrives.',
  run(runs) {
    const probe = meanProbe(runs.map(r => r.probe))
    const meals = mergeMeals(runs)
    const rows = Object.entries(probe)
      .filter(([, s]) => s.samples > 0)
      .map(([id, s]) => {
        // Samples are creature-observations at a fixed cadence, so
        // `samples * SAMPLE_SECONDS` is creature-seconds of life observed.
        const creatureMinutes = (s.samples * SAMPLE_SECONDS) / 60
        const eaten = (meals[id]?.plants ?? 0) + (meals[id]?.animals ?? 0)
        return { id, rate: creatureMinutes > 0 ? eaten / creatureMinutes : 0, hunt: huntShare(s) }
      })
    const med = median(rows.map(r => r.rate))
    return {
      pass: med >= 0.25,
      value: med,
      bar: 'median species eats ≥ 0.25 times per creature-minute',
      detail: rows
        .sort((a, b) => a.rate - b.rate)
        .map(r => `${r.id} ${r.rate.toFixed(2)}/min (hunt ${pct(r.hunt)})`)
        .join('  '),
    }
  },
}

const breedingGateOpens: EvalCheck = {
  id: 'breeding-gate-opens',
  what: 'Animals spend a real share of their lives *allowed* to breed.',
  points_at: 'Tuning: breedAt, breedCost, breedCooldown, or the maturity age.',
  run(runs) {
    const probe = meanProbe(runs.map(r => r.probe))
    const shares = Object.values(probe).map(s => s.readyShare)
    const med = median(shares)
    return {
      pass: med >= 0.1,
      value: med,
      bar: 'median species is breeding-ready ≥ 10% of samples',
      detail: describeBlockers(probe),
    }
  },
}

const readyAnimalsSeekMates: EvalCheck = {
  id: 'ready-animals-seek-mates',
  what: 'An animal that *may* breed actually goes looking for a partner.',
  points_at: 'Priority order in `look` — `mate` sits behind both prey branches.',
  run(runs) {
    const probe = meanProbe(runs.map(r => r.probe))
    // Only species that get the chance at all; a species the gate never opens
    // for would otherwise report 0 here and blame the wrong thing.
    const eligible = Object.entries(probe).filter(([, s]) => s.ready > 0)
    const med = median(eligible.map(([, s]) => s.matingWhileReady))
    return {
      pass: med >= 0.2,
      value: med,
      bar: 'median species spends ≥ 20% of its ready time in `mate` mood',
      detail: eligible
        .map(([id, s]) => `${id} ${pct(s.matingWhileReady)} (hunt ${pct(huntShare(s))})`)
        .join('  '),
    }
  },
}

const mateStintsConvert: EvalCheck = {
  id: 'mate-stints-convert',
  what: 'Having set out to find a partner, an animal arrives often enough.',
  points_at: 'Pathing/targeting: steering has no pathfinder, so terrain blocks mates.',
  run(runs) {
    const probe = meanProbe(runs.map(r => r.probe))
    const births = mergeBirths(runs)
    const rows = Object.entries(probe)
      .filter(([, s]) => s.mateStints > 0)
      .map(([id, s]) => ({ id, rate: (births[id] ?? 0) / s.mateStints, stints: s.mateStints }))
    const med = median(rows.map(r => r.rate))
    return {
      pass: med >= 0.1,
      value: med,
      bar: 'median species converts ≥ 10% of mate stints into a birth',
      detail: rows.map(r => `${r.id} ${(r.rate * 100).toFixed(0)}% of ${r.stints}`).join('  '),
    }
  },
}

const lineagesAdvance: EvalCheck = {
  id: 'lineages-advance',
  what: 'Surviving animals are descendants, not the founders still standing there.',
  points_at: 'Breeding overall. Founders are generation 1; anything born is ≥ 2.',
  run(runs) {
    // The end-state version of the birth counters, and the one that cannot be
    // gamed by a species that breeds once and then stops: an average generation
    // above 1 means the population alive at the end was substantially *made*
    // during the run rather than seeded at the start of it.
    const animals = new Set(animalIds(runs))
    const gens: number[] = []
    for (const r of runs) {
      for (const [id, d] of Object.entries(r.drift)) {
        if (animals.has(id) && (r.survivors[id] ?? 0) >= 3) gens.push(d.gen)
      }
    }
    const med = median(gens)
    return {
      pass: med >= 1.5,
      value: med,
      bar: 'median surviving animal species averages generation ≥ 1.5',
      detail: gens.length ? `n=${gens.length} species-runs` : 'no species had ≥3 survivors',
    }
  },
}

// ---------------------------------------------------------------------------
// The world itself
// ---------------------------------------------------------------------------

const worldStaysSolid: EvalCheck = {
  id: 'world-stays-solid',
  what: 'Terrain is not being quietly eaten away.',
  points_at: 'Acid, diggers, or a material conversion with no ceiling.',
  run(runs) {
    const worst = Math.min(...runs.map(r => r.solidFraction))
    const start = 0.3
    return {
      pass: worst >= start * 0.8,
      value: worst,
      bar: 'solid fraction stays within 20% of its starting share',
      detail: runs.map(r => `seed ${r.seed}: ${pct(r.solidFraction)}`).join('  '),
    }
  },
}

function huntShare(s: SpeciesProbe): number {
  return s.samples > 0 ? s.moodShare.hunt / s.samples : 0
}

/**
 * Seconds of creature-life one probe sample stands for.
 *
 * Tied to `RunOptions.sampleEveryTicks` (6) and `TICK_S` (1/60). If the sample
 * cadence changes, this changes with it or every per-minute rate silently
 * rescales.
 */
const SAMPLE_SECONDS = 6 / 60

function mergeMeals(runs: RunMetrics[]): Record<string, { plants: number; animals: number }> {
  const out: Record<string, { plants: number; animals: number }> = {}
  for (const r of runs) {
    for (const [id, m] of Object.entries(r.meals)) {
      out[id] ??= { plants: 0, animals: 0 }
      out[id].plants += m.plants
      out[id].animals += m.animals
    }
  }
  return out
}

function mergeBirths(runs: RunMetrics[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of runs) {
    for (const [id, n] of Object.entries(r.births)) out[id] = (out[id] ?? 0) + n
  }
  return out
}

/** Which clause is shutting the gate, summed across species. */
function describeBlockers(probe: Record<string, SpeciesProbe>): string {
  const totals: Record<BreedBlocker, number> = {
    cooldown: 0,
    underfed: 0,
    'no-headroom': 0,
    'too-young': 0,
  }
  for (const s of Object.values(probe)) {
    for (const k of Object.keys(totals) as BreedBlocker[]) totals[k] += s.blockedBy[k]
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  return (Object.entries(totals) as [BreedBlocker, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${pct(n / sum)}`)
    .join('  ')
}

/**
 * Order is the debugging order, not the importance order.
 *
 * The headline checks come first because they are what you look at; the causal
 * chain runs the other way. `foraging-feeds-animals` is upstream of every
 * breeding check, and the breeding checks run gate → priority → arrival. Fix
 * the first failure in that chain before reading the ones after it.
 */
export const CHECKS: EvalCheck[] = [
  runOutlastsMaturity,
  noAnimalExtinctions,
  populationOscillates,
  foragingFeedsAnimals,
  breedingGateOpens,
  readyAnimalsSeekMates,
  mateStintsConvert,
  lineagesAdvance,
  worldStaysSolid,
]

export function runChecks(runs: RunMetrics[]): EvalResult[] {
  return CHECKS.map(c => ({ id: c.id, what: c.what, points_at: c.points_at, ...c.run(runs) }))
}
