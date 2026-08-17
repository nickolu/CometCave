/**
 * Why breeding is or is not happening — as three numbers that point at three
 * different bugs.
 *
 * "No animal is breeding" is a symptom, and the fixes for its causes are
 * opposite to each other. Turning a knob when the real problem is the priority
 * order in `look` makes the world worse in a way that still shows no births, and
 * the next person reads that as "the knob didn't help" rather than "the knob was
 * never the problem". This probe exists so that never has to be a guess.
 *
 * Read the three in order; the first one that is broken is the one to fix.
 *
 * 1. **`readyShare`** — of all the moments a creature existed, how many was it
 *    *allowed* to breed? Low means the gate itself is shut: hunger threshold,
 *    breed cost headroom, cooldown or maturity age. `blockedBy` says which.
 *    → a tuning problem.
 *
 * 2. **`matingWhileReady`** — of the moments it was allowed to breed, how many
 *    did it spend actually looking for a mate? Low means something else keeps
 *    winning the decision. In `look`, `mate` sits third: behind locked-on prey
 *    *and* behind merely-smelled prey, which sets `hunt` with no target at all.
 *    A well-fed animal that can smell food anywhere in its hunger reach never
 *    reaches the `mate` branch.
 *    → a priority problem.
 *
 * 3. **`birthsPerMateStint`** — having gone looking, how often did it arrive?
 *    A stint is one unbroken run of `mate` mood. Low means creatures want to
 *    breed, pick a partner, and never close the gap: there is no pathfinding
 *    here, only steering, so a partner behind terrain is a partner you walk into
 *    a wall toward.
 *    → a pathing/targeting problem.
 *
 * Plants are excluded throughout. They breed by a different economy (no hunger
 * cost, no mate, their own caps) and including them drags every ratio toward the
 * answer for a species that was never in question.
 *
 * "Plant" here means `isPlantLike`, and it used to mean `move.kind === 'root'`,
 * which is a different question with the same answer for every species but one.
 * Skybloom is a flower that flies: `tags: ['plant']`, eats nothing, needs no
 * partner, and rooted-ness says it is an animal. It produced 428 of one
 * baseline's 432 births and single-handedly held `lineages-advance` green while
 * the six real animals of the meadow managed four births between them — the
 * guardrail against "nothing actually bred", satisfied by a flower. Rooted-ness
 * is about how a thing pays for a child; `isPlantLike` is about whether it is a
 * plant, and that is the question this file is asking.
 */
import { isPlantLike } from '@/app/micro-land/domain/blueprint'
import { type BreedBlocker, breedingBlockers } from '@/app/micro-land/domain/sim/creature-sim'
import type { CreatureMood, WorldState } from '@/app/micro-land/domain/types'

const MOODS: CreatureMood[] = ['wander', 'hunt', 'flee', 'eat', 'rest', 'mate']

export interface SpeciesProbe {
  /** Creature-samples observed. The denominator for `readyShare` and `moodShare`. */
  samples: number
  /** Samples where every clause of the breeding gate passed. */
  ready: number
  /** Samples where the creature was ready *and* in `mate` mood. */
  readyAndMating: number
  /** Ready samples by what was blocking. A sample can be blocked by several. */
  blockedBy: Record<BreedBlocker, number>
  /** Share of all samples spent in each mood. */
  moodShare: Record<CreatureMood, number>
  /** Unbroken runs of `mate` mood begun. */
  mateStints: number
  /** Mate stints that ended with the creature still holding a target. */
  mateStintsWithTarget: number

  // --- derived, filled by `foldProbe` --------------------------------------
  /** `ready / samples`. Low → tuning. */
  readyShare: number
  /** `readyAndMating / ready`. Low → priority order in `look`. */
  matingWhileReady: number
}

export interface BreedingProbe {
  /** blueprintId → probe. Animals only. */
  species: Record<string, SpeciesProbe>
  /** Per-creature mood on the previous sample, for stint detection. */
  lastMood: Map<number, CreatureMood>
}

export function emptyProbe(): BreedingProbe {
  return { species: {}, lastMood: new Map() }
}

function emptySpecies(): SpeciesProbe {
  return {
    samples: 0,
    ready: 0,
    readyAndMating: 0,
    blockedBy: { cooldown: 0, underfed: 0, 'no-headroom': 0, 'too-young': 0 },
    moodShare: { wander: 0, hunt: 0, flee: 0, eat: 0, rest: 0, mate: 0 },
    mateStints: 0,
    mateStintsWithTarget: 0,
    readyShare: 0,
    matingWhileReady: 0,
  }
}

/**
 * Read every creature once. Called from the tick loop, not from inside the sim.
 *
 * O(creatures) per sample at 10 Hz against a population capped in the hundreds —
 * cheaper than one tick of the sense pass, and it buys the only view anyone has
 * of *why* the population is doing what it is doing.
 */
export function sampleProbe(probe: BreedingProbe, w: WorldState): void {
  const alive = new Set<number>()

  for (const c of w.creatures) {
    const bp = w.blueprints[c.blueprintId]
    if (!bp || isPlantLike(bp)) continue

    alive.add(c.id)
    const s = (probe.species[c.blueprintId] ??= emptySpecies())

    s.samples++
    s.moodShare[c.mood]++

    const blockers = breedingBlockers(c, bp)
    if (blockers.length === 0) {
      s.ready++
      if (c.mood === 'mate') s.readyAndMating++
    } else {
      for (const b of blockers) s.blockedBy[b]++
    }

    // A stint is an *entry* into mate mood — counted on the transition so that a
    // creature parked in `mate` for a hundred samples is one attempt to arrive,
    // not a hundred. Without that, `birthsPerMateStint` would read as "almost
    // never succeeds" for a creature that is succeeding slowly, which is the
    // pathing verdict, and it would be wrong.
    const was = probe.lastMood.get(c.id)
    if (c.mood === 'mate' && was !== 'mate') {
      s.mateStints++
      if (c.targetId !== null) s.mateStintsWithTarget++
    }
    probe.lastMood.set(c.id, c.mood)
  }

  // Creatures die constantly; without this the map grows for the whole run.
  for (const id of probe.lastMood.keys()) if (!alive.has(id)) probe.lastMood.delete(id)
}

/** Turn the counters into the ratios the eval reads. */
export function foldProbe(probe: BreedingProbe): BreedingProbe {
  for (const s of Object.values(probe.species)) {
    s.readyShare = s.samples > 0 ? s.ready / s.samples : 0
    s.matingWhileReady = s.ready > 0 ? s.readyAndMating / s.ready : 0
  }
  return probe
}

/** Average a probe across runs, so no verdict rests on one seed. */
export function meanProbe(probes: BreedingProbe[]): Record<string, SpeciesProbe> {
  const ids = new Set(probes.flatMap(p => Object.keys(p.species)))
  const out: Record<string, SpeciesProbe> = {}

  for (const id of ids) {
    const rows = probes.map(p => p.species[id]).filter((r): r is SpeciesProbe => !!r)
    const acc = emptySpecies()
    for (const r of rows) {
      acc.samples += r.samples
      acc.ready += r.ready
      acc.readyAndMating += r.readyAndMating
      acc.mateStints += r.mateStints
      acc.mateStintsWithTarget += r.mateStintsWithTarget
      for (const b of Object.keys(acc.blockedBy) as BreedBlocker[])
        acc.blockedBy[b] += r.blockedBy[b]
      for (const m of MOODS) acc.moodShare[m] += r.moodShare[m]
    }
    acc.readyShare = acc.samples > 0 ? acc.ready / acc.samples : 0
    acc.matingWhileReady = acc.ready > 0 ? acc.readyAndMating / acc.ready : 0
    out[id] = acc
  }
  return out
}

export { MOODS }
