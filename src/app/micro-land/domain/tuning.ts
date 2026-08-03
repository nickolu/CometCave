/**
 * The knobs, and the fact that they turn.
 *
 * `constants.ts` is the record of what every number should be and why. This is
 * the small subset of those numbers the simulation reads through a *mutable*
 * object, so they can be moved while the world is running.
 *
 * Every default here is imported from `constants.ts` rather than restated. The
 * reasoning stays in one place, and a shipped default can never quietly drift
 * away from the one the panel resets to.
 *
 * The simulation reads `TUNING.x`, never the constant it came from. That costs
 * one property lookup on a hot path, which is nothing; what it buys is a world
 * you can rebalance by watching it. "The native plants grow too fast" is not a
 * complaint you can reason your way to a replacement number for — it is a thing
 * you drag a slider on until the meadow looks right.
 *
 * Not everything in `constants.ts` belongs here. A knob earns its place by
 * being something worth *watching* change: how much green the ground pushes
 * for, how often, how crowded one species is allowed to get. World size, tick
 * rate and the record thresholds are not knobs — they are the shape of the
 * game, and a slider that can break the renderer is not an option, it's a trap.
 */
import {
  BREED_COOLDOWN,
  BREED_COST,
  GRAVITY,
  MATE_RADIUS,
  MAX_CREATURES,
  MAX_PLANTS,
  MEAL_VALUE,
  NATIVE_PLANT_SPECIES,
  NATIVE_PLANT_TARGET,
  PLANT_MATURITY,
  PLANT_SEED_BATCH,
  PLANT_SEED_INTERVAL,
  PLANT_SPECIES_CAP,
  PLANT_SPREAD_COOLDOWN,
  SPECIES_SOFT_CAP,
  TRAIT_DRIFT,
} from '@/app/micro-land/domain/constants'

/**
 * Defaults, in the order the panel shows them.
 *
 * Counts that `constants.ts` scales by `WIDTH_SCALE` arrive here already
 * scaled, so a slider labelled "most plants at once" says how many plants there
 * will actually be in the three-screen world rather than in a screen that no
 * longer exists.
 */
export const TUNING_DEFAULTS = {
  nativePlantTarget: NATIVE_PLANT_TARGET,
  plantSeedInterval: PLANT_SEED_INTERVAL,
  plantSeedBatch: PLANT_SEED_BATCH,
  plantMaturity: PLANT_MATURITY,
  plantSpreadCooldown: PLANT_SPREAD_COOLDOWN,
  maxPlants: MAX_PLANTS,
  plantSpeciesCap: PLANT_SPECIES_CAP,
  nativePlantSpecies: NATIVE_PLANT_SPECIES,

  maxCreatures: MAX_CREATURES,
  speciesSoftCap: SPECIES_SOFT_CAP,
  breedCooldown: BREED_COOLDOWN,
  mateRadius: MATE_RADIUS,
  mealValue: MEAL_VALUE,
  breedCost: BREED_COST,
  traitDrift: TRAIT_DRIFT,

  gravity: GRAVITY,
}

export type TuningKey = keyof typeof TUNING_DEFAULTS
export type Tuning = Record<TuningKey, number>

export type KnobGroup = 'plants' | 'creatures' | 'world'

export interface Knob {
  key: TuningKey
  group: KnobGroup
  /** What the slider is called. Plain language — this panel is for a player. */
  label: string
  /** One line under it, saying what turning it up actually does. */
  help: string
  min: number
  max: number
  step: number
  /** Appended to the number, for the ones where a bare integer means nothing. */
  unit?: string
}

export const KNOB_GROUPS: { id: KnobGroup; title: string; blurb: string }[] = [
  {
    id: 'plants',
    title: 'Green things',
    blurb:
      'Plants are the bottom of the food chain, so these move everything above them too. Turn them down and the world gets hungrier.',
  },
  {
    id: 'creatures',
    title: 'Living things',
    blurb: 'How crowded the land gets, and how quickly anything makes more of itself.',
  },
  { id: 'world', title: 'The world itself', blurb: 'Rules that apply to everything at once.' },
]

/**
 * Ranges are wide on purpose.
 *
 * The point of the panel is to find out what a world feels like at a number
 * nobody would have written down, so the ends are set where the simulation
 * stops *working* rather than where it stops being balanced. A slider that only
 * offers sensible values can't tell you anything you didn't already know.
 */
export const KNOBS: Knob[] = [
  {
    key: 'nativePlantTarget',
    group: 'plants',
    label: 'Green the ground pushes for',
    help: 'The soil keeps sprouting until there are roughly this many, then stops and lets plants spread on their own. So this sets how fast a stripped world greens over, not how green it ends up.',
    min: 0,
    max: 400,
    step: 5,
    unit: 'plants',
  },
  {
    key: 'plantSeedInterval',
    group: 'plants',
    label: 'Wait between sproutings',
    help: 'How long the ground pauses before it seeds again. Longer means green comes back more slowly after a crash.',
    min: 1,
    max: 60,
    step: 1,
    unit: 's',
  },
  {
    key: 'plantSeedBatch',
    group: 'plants',
    label: 'Sprouts at a time',
    help: 'Most plants one seeding can place, when the world is completely bare.',
    min: 1,
    max: 30,
    step: 1,
  },
  {
    key: 'plantMaturity',
    group: 'plants',
    label: 'Age before a plant can spread',
    help: 'How long a new plant has to stand there before it is allowed to make another.',
    min: 1,
    max: 120,
    step: 1,
    unit: 's',
  },
  {
    key: 'plantSpreadCooldown',
    group: 'plants',
    label: 'Wait between spreads',
    help: 'How long a grown plant rests after spreading. This is how fast a meadow fills in on its own.',
    min: 1,
    max: 180,
    step: 1,
    unit: 's',
  },
  {
    key: 'maxPlants',
    group: 'plants',
    label: 'Most plants at once',
    help: 'A hard ceiling. Nothing green is born past this, no matter what else is set.',
    min: 10,
    max: 1000,
    step: 5,
  },
  {
    key: 'plantSpeciesCap',
    group: 'plants',
    label: 'Most of any one plant',
    help: 'Every plant species settles right about here, so this is really how green a grown-in world looks. Turn it down to thin the meadow out — the grazers get hungrier, and there end up being more of them.',
    min: 5,
    max: 600,
    step: 5,
  },
  {
    key: 'nativePlantSpecies',
    group: 'plants',
    label: 'Kinds of plant the ground picks',
    help: 'How many species the soil settles on the first time it decides. Takes effect in the next land you make.',
    min: 1,
    max: 8,
    step: 1,
  },

  {
    key: 'maxCreatures',
    group: 'creatures',
    label: 'Most creatures at once',
    help: 'A hard ceiling on everything alive, plants included. Placing and summoning still work past it.',
    min: 20,
    max: 2000,
    step: 10,
  },
  {
    key: 'speciesSoftCap',
    group: 'creatures',
    label: 'Most of any one animal',
    help: 'The land saying there is only so much room here. This is what turns a population crash into a rise and fall.',
    min: 5,
    max: 800,
    step: 5,
  },
  {
    key: 'breedCooldown',
    group: 'creatures',
    label: 'Rest between babies',
    help: 'How long an animal waits after having one before it can have another.',
    min: 1,
    max: 120,
    step: 1,
    unit: 's',
  },
  {
    key: 'mateRadius',
    group: 'creatures',
    label: 'How close a pair has to get',
    help: 'An animal needs a well-fed partner of its own kind to have a baby, and this is how near the two have to be. They spot each other from as far as they can see and walk over; turn this up and they settle for standing roughly nearby, which makes a thinly spread species much more likely to survive.',
    min: 2,
    max: 40,
    step: 1,
    unit: 'tiles',
  },
  {
    key: 'mealValue',
    group: 'creatures',
    label: 'How filling a meal is',
    help: 'How much of an empty stomach one bite fills. A meal is always kept a little short of a baby — otherwise everything breeds on every mouthful and eats the world.',
    min: 0.05,
    max: 0.95,
    step: 0.01,
  },
  {
    key: 'breedCost',
    group: 'creatures',
    label: 'What a baby costs a parent',
    help: 'How much of a full stomach having one uses up.',
    min: 0.1,
    max: 1,
    step: 0.01,
  },
  {
    key: 'traitDrift',
    group: 'creatures',
    label: 'How much a baby takes after its parents',
    help: 'Every animal is a little faster or slower, sharper-eyed or blinder, longer or shorter lived than the two it came from, and a little different in colour. This is how big that step is. Turn it up and a family changes in front of you; set it to nothing and every creature is exactly its own kind forever. Nothing you place is ever affected — only things born here.',
    min: 0,
    max: 0.4,
    step: 0.01,
  },
  {
    key: 'gravity',
    group: 'world',
    label: 'Pull downwards',
    help: 'How hard everything falls. Each world scales this again on its own, so the station stays floaty.',
    min: 4,
    max: 90,
    step: 1,
  },
]

const KNOB_BY_KEY: Record<TuningKey, Knob> = Object.fromEntries(
  KNOBS.map(k => [k.key, k])
) as Record<TuningKey, Knob>

/**
 * The live values. This object is read by the simulation every tick.
 *
 * Mutated in place rather than replaced, so the modules that closed over it at
 * import time see every change without anyone having to re-wire them.
 */
export const TUNING: Tuning = { ...TUNING_DEFAULTS }

/**
 * The one relationship between two knobs that isn't allowed to break.
 *
 * If a meal more than pays for a child, grazers breed on every full stomach,
 * overshoot the plants, and take the entire food chain down with them — a
 * failure that looks like a thriving world for about ninety seconds. The panel
 * says so in the help text; this makes sure it stays true regardless.
 */
const MEAL_HEADROOM = 0.05

function clampKnob(key: TuningKey, value: number): number {
  const knob = KNOB_BY_KEY[key]
  if (!knob || !Number.isFinite(value)) return TUNING_DEFAULTS[key]
  const clamped = Math.max(knob.min, Math.min(knob.max, value))
  // Integer steps mean integer values: a batch of 2.6 sprouts is a rounding
  // decision made somewhere further down, where nobody can see it.
  return knob.step >= 1 ? Math.round(clamped) : clamped
}

function enforceInvariants(t: Tuning): void {
  t.mealValue = Math.min(t.mealValue, t.breedCost - MEAL_HEADROOM)
  t.mealValue = Math.max(KNOB_BY_KEY.mealValue.min, t.mealValue)
}

/** Move one or more knobs. Values outside a knob's range are clamped, not rejected. */
export function setTuning(patch: Partial<Tuning>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in TUNING_DEFAULTS)) continue
    TUNING[key as TuningKey] = clampKnob(key as TuningKey, value as number)
  }
  enforceInvariants(TUNING)
}

export function resetTuning(): void {
  Object.assign(TUNING, TUNING_DEFAULTS)
}

/** Which knobs are currently away from their shipped value. */
export function changedKnobs(t: Tuning = TUNING): TuningKey[] {
  return (Object.keys(TUNING_DEFAULTS) as TuningKey[]).filter(
    key => t[key] !== TUNING_DEFAULTS[key]
  )
}

// ---------------------------------------------------------------------------
// Remembering the settings
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'micro-land:tuning:v1'

/**
 * Only the differences are stored, never the whole set.
 *
 * A player who never touched a knob keeps getting whatever the game ships with,
 * including next month's rebalance. Writing the whole set would freeze the
 * defaults of the day they first opened the panel into their browser forever.
 */
export function saveTuning(): void {
  const diff: Partial<Tuning> = {}
  for (const key of changedKnobs()) diff[key] = TUNING[key]
  try {
    if (Object.keys(diff).length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(diff))
  } catch {
    // Private-mode Safari throws on write. Losing the settings is survivable;
    // taking the game down with it is not.
  }
}

/** Read stored knobs and apply them. Safe to call before anything else exists. */
export function loadTuning(): void {
  let raw: string | null = null
  try {
    // `localStorage` *throws on read* in private-mode Safari, so even looking
    // has to be wrapped.
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return
  }
  if (!raw) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') setTuning(parsed as Partial<Tuning>)
  } catch {
    // Someone edited it by hand, or a past version wrote something else. The
    // defaults are a perfectly good answer.
  }
}

export function clearStoredTuning(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // See saveTuning.
  }
}
