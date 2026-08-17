/**
 * The headless world, as something you can measure instead of read.
 *
 * `scripts/micro-land-sim.ts` prints a population table for a person to squint
 * at. That is genuinely useful for "does this look alive", and useless for "did
 * my change help" — a human reading two tables side by side cannot tell a real
 * improvement from a different seed. This module runs the same simulation and
 * returns numbers, so an eval can assert on them and a diff can be attributed.
 *
 * Two rules hold this together and both are worth stating.
 *
 * **The simulation is not instrumented.** Everything here is observed from
 * outside the tick: mood, hunger, age and breeding readiness are already on the
 * creature, so the harness samples them rather than asking `creature-sim` to
 * count things for it. The alternative — counters threaded through the sim —
 * would mean the thing under test is not the thing that ships, and would put
 * harness concerns inside a file whose whole discipline is that a creature is
 * data. The one exception is `breedingBlockers`, which is a read-only question
 * about a creature, not a counter.
 *
 * **Runs are comparable across branches, not deterministic.** Seeds come from
 * `seedFor(i)` and the tick order is fixed, but `emitParticles`, spawn animation
 * phase and theme decoration all call `Math.random()` (see the skill's "known
 * hazards"). So: same seed on two branches is a fair comparison, and a single
 * run is never evidence. Everything here is built to be averaged over `runs`.
 */
import { THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import { TICK_S } from '@/app/micro-land/domain/constants'
import {
  type SimEvent,
  breedingBlockers,
  founderMaturityAge,
  tickCreatures,
} from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { tickTiles } from '@/app/micro-land/domain/sim/tile-sim'
import {
  applyTheme,
  countByBlueprint,
  createWorld,
  seedStarters,
} from '@/app/micro-land/domain/sim/world'
import type { CreatureMood, WorldState } from '@/app/micro-land/domain/types'

import { emptyProbe, foldProbe, sampleProbe } from './breeding-probe'

import type { BreedingProbe, SpeciesProbe } from './breeding-probe'

export interface RunOptions {
  themeId: string
  seconds: number
  seed: number
  /**
   * How often to sample creature state, in ticks.
   *
   * 6 ticks is 10 Hz, which is the cadence the sense pass itself runs at
   * (`SENSE_EVERY`) — sampling faster only re-reads a decision that has not been
   * revisited. Sampling much slower starts to miss short-lived moods, and `mate`
   * is exactly the short-lived mood this is here to catch.
   */
  sampleEveryTicks?: number
}

export interface RunMetrics {
  themeId: string
  seed: number
  seconds: number

  /** blueprintId → alive at the end. */
  survivors: Record<string, number>
  /** Seeded at t=0, gone at the end. */
  extinctions: string[]
  /** Seeded at t=0 — the denominator for extinction rate. */
  seeded: string[]

  peak: number
  /** Lowest total population after the opening 20s scramble. */
  lowWater: number
  alive: number

  /** blueprintId → cause → count. */
  deaths: Record<string, Record<string, number>>
  /** blueprintId → what it ate. */
  meals: Record<string, { plants: number; animals: number }>
  /** blueprintId → births. The number every breeding question comes back to. */
  births: Record<string, number>

  /** Share of the world still made of something, 0..1. */
  solidFraction: number

  /** blueprintId → averaged over survivors. `gen` is the reality check on the rest. */
  drift: Record<string, { speed: number; sight: number; lifespan: number; gen: number }>

  /** Why breeding did or did not happen. See `breeding-probe.ts`. */
  probe: BreedingProbe

  /**
   * blueprintId → the age a founder may first breed at, in world seconds.
   *
   * Carried on the result so a check can ask whether the run was long enough to
   * have observed breeding at all, rather than reporting "nothing bred" for a
   * window in which nothing *could* have.
   */
  maturityAge: Record<string, number>
}

/** Comparable across branches: run `i` is the same world on every checkout. */
export function seedFor(i: number): number {
  return 1000 + i * 7919
}

export function runWorld(opts: RunOptions): RunMetrics {
  const { themeId, seconds, seed, sampleEveryTicks = 6 } = opts
  const theme = THEME_BY_ID[themeId]
  if (!theme) throw new Error(`Unknown theme "${themeId}"`)

  const world = createWorld(seed)
  const rng = makeRng(seed ^ 0x9e3779b9)
  applyTheme(world, themeId, seed)
  seedStarters(world, themeId, rng)

  const seeded = Object.keys(countByBlueprint(world))
  const totalTicks = Math.floor(seconds / TICK_S)

  const deaths: RunMetrics['deaths'] = {}
  const meals: RunMetrics['meals'] = {}
  const births: RunMetrics['births'] = {}
  const probe = emptyProbe()

  let tileCounter = 0
  let peak = world.creatures.length
  let lowWater = Infinity

  for (let tick = 1; tick <= totalTicks; tick++) {
    const events: SimEvent[] = []
    world.elapsed += TICK_S
    if (++tileCounter >= 3) {
      tileCounter = 0
      tickTiles(world)
    }
    tickCreatures(world, TICK_S, rng, theme.gravity, events)

    for (const e of events) {
      if (e.kind === 'born') {
        births[e.blueprintId] = (births[e.blueprintId] ?? 0) + 1
        continue
      }
      if (e.kind === 'ate') {
        meals[e.blueprintId] ??= { plants: 0, animals: 0 }
        const victim = e.victimId ? world.blueprints[e.victimId] : undefined
        if (victim?.move.kind === 'root') meals[e.blueprintId].plants++
        else meals[e.blueprintId].animals++
        continue
      }
      // 'notice' and 'diversity-rescue' are announcements, not deaths.
      if (e.kind === 'notice' || e.kind === 'diversity-rescue' || e.kind === 'extinction') continue
      deaths[e.blueprintId] ??= {}
      deaths[e.blueprintId][e.kind] = (deaths[e.blueprintId][e.kind] ?? 0) + 1
    }

    peak = Math.max(peak, world.creatures.length)
    // The opening 20s is the scramble, not the steady state.
    if (world.elapsed > 20) lowWater = Math.min(lowWater, world.creatures.length)

    if (tick % sampleEveryTicks === 0) sampleProbe(probe, world)
  }

  const survivors = countByBlueprint(world)

  return {
    themeId,
    seed,
    seconds,
    survivors,
    seeded,
    extinctions: seeded.filter(id => !survivors[id]),
    peak,
    lowWater: lowWater === Infinity ? 0 : lowWater,
    alive: world.creatures.length,
    deaths,
    meals,
    births,
    solidFraction: solidFractionOf(world),
    drift: driftOf(world, survivors),
    probe: foldProbe(probe),
    maturityAge: maturityAges(world, seeded),
  }
}

function maturityAges(w: WorldState, seeded: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of seeded) {
    const bp = w.blueprints[id]
    if (bp) out[id] = founderMaturityAge(bp)
  }
  return out
}

function solidFractionOf(w: WorldState): number {
  let solid = 0
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] !== 0) solid++
  return solid / w.tiles.length
}

/**
 * Averaged over survivors, which is the population selection actually produced.
 * Averaging over everything that ever lived folds in exactly the individuals the
 * world rejected and pulls the answer back toward 1.
 */
function driftOf(w: WorldState, survivors: Record<string, number>): RunMetrics['drift'] {
  const drift: RunMetrics['drift'] = {}
  for (const c of w.creatures) {
    const d = (drift[c.blueprintId] ??= { speed: 0, sight: 0, lifespan: 0, gen: 0 })
    d.speed += c.traits.speed
    d.sight += c.traits.sight
    d.lifespan += c.traits.lifespan
    d.gen += c.generation
  }
  for (const [id, d] of Object.entries(drift)) {
    const n = survivors[id] || 1
    d.speed /= n
    d.sight /= n
    d.lifespan /= n
    d.gen /= n
  }
  return drift
}

/** Run the same world on N seeds. The unit of evidence is the set, never one run. */
export function runSeeds(opts: Omit<RunOptions, 'seed'> & { runs: number }): RunMetrics[] {
  const out: RunMetrics[] = []
  for (let i = 0; i < opts.runs; i++) {
    out.push(runWorld({ ...opts, seed: seedFor(i) }))
  }
  return out
}

export type { BreedingProbe, SpeciesProbe, CreatureMood }
export { breedingBlockers, founderMaturityAge }
