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
  DISEASE_DURATION,
  DISEASE_SPREAD_CHANCE,
  GRAVITY,
  HUNGER_RATE_SCALE,
  LIFESPAN_SCALE,
  MATE_RADIUS,
  MAX_CREATURES,
  MAX_PLANTS,
  MIGRATION_THRESHOLD,
  MEAL_VALUE,
  NATIVE_PLANT_SPECIES,
  NATIVE_PLANT_TARGET,
  PLANT_CROWDING_STRENGTH,
  PLANT_MATURITY,
  PLANT_SEED_BATCH,
  PLANT_SEED_INTERVAL,
  PLANT_SPECIES_CAP,
  PLANT_SPREAD_COOLDOWN,
  PLANT_SPREAD_MIN,
  POLLINATION_CARRY_SECONDS,
  POLLINATION_ONLY,
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
  lifespanScale: LIFESPAN_SCALE,
  mateRadius: MATE_RADIUS,
  hungerRateScale: HUNGER_RATE_SCALE,
  mealValue: MEAL_VALUE,
  breedCost: BREED_COST,
  traitDrift: TRAIT_DRIFT,
  /**
   * Base probability per tick that a sick creature infects a healthy neighbour.
   * Setting this to 0 disables animal-to-animal disease spread entirely.
   */
  diseaseSpreadChance: DISEASE_SPREAD_CHANCE,
  /** How long a creature stays sick, in sim-seconds. */
  diseaseDuration: DISEASE_DURATION,
  /**
   * Seconds without food before a creature steers toward greener terrain.
   * The 30-second expanded-sight range kicks in first; this is the longer wait
   * before the creature actually changes course.
   */
  migrationThreshold: MIGRATION_THRESHOLD,

  gravity: GRAVITY,
  /** Horizontal water current — positive pushes swimmers rightward, tiles/s². */
  currentX: 0,
  /** Vertical water current — positive pushes swimmers downward, tiles/s². */
  currentY: 0,
  /**
   * How long one seasonal cycle lasts, in sim seconds.
   * 300 = five real-world minutes at normal speed.
   */
  seasonPeriod: 300,
  /**
   * How much seasons swing plant availability, 0..1.
   * 0 = no seasonal effect. 0.7 = ×0.3 at trough, ×1.7 at peak.
   */
  seasonAmplitude: 0,
  /**
   * How long one day/night cycle lasts, in sim seconds.
   * 0 = no day/night cycle (default). 120 = one cycle every two real-world minutes at normal speed.
   */
  dayLengthSeconds: 0,
  /**
   * How long an egg takes to hatch, in sim seconds.
   */
  eggHatchSeconds: 15,
  /**
   * How long a pollinator can carry a seed before it auto-drops, in sim seconds.
   */
  pollinationCarrySeconds: POLLINATION_CARRY_SECONDS,
  pollinationOnly: POLLINATION_ONLY,
  plantCrowdingStrength: PLANT_CROWDING_STRENGTH,
  plantSpreadMin: PLANT_SPREAD_MIN,
  /**
   * Multiplies every world-generator's intervalSeconds at runtime.
   * 1.0 = default. 2.0 = half the seeding rate. 0.5 = double the rate.
   */
  generatorRateMultiplier: 1.0,
  /** Max placed spawners the world can hold at once. */
  maxSpawners: 20,
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
  /** When 'toggle', renders a checkbox instead of a slider. Expects min=0, max=1, step=1. */
  type?: 'range' | 'toggle'
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
    key: 'generatorRateMultiplier',
    group: 'plants',
    label: 'Generator rate',
    help: 'Scales how often world generators seed new creatures. 2× means half as often; 0.5× means twice as often.',
    min: 0.1,
    max: 5,
    step: 0.1,
    unit: '×',
    type: 'range',
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
    key: 'pollinationCarrySeconds',
    group: 'plants',
    label: 'How long a bee carries a seed',
    help: 'A pollinator picks up a seed when it brushes past a plant and drops it wherever it travels next. This is how long before it drops on its own.',
    min: 5,
    max: 120,
    step: 5,
    unit: 's',
  },
  {
    key: 'pollinationOnly',
    group: 'plants',
    label: 'Pollination only',
    help: 'When on, plants can only spread by pollinator seed-carriers — they cannot reproduce on their own.',
    min: 0,
    max: 1,
    step: 1,
    type: 'toggle',
  },
  {
    key: 'plantCrowdingStrength',
    group: 'plants',
    label: 'Crowding penalty',
    help: 'How much slower a plant spreads for each same-species neighbour within 12 tiles. Higher values break up clusters more aggressively.',
    min: 0,
    max: 5,
    step: 0.05,
  },
  {
    key: 'plantSpreadMin',
    group: 'plants',
    label: 'Min spread distance',
    help: 'Minimum tiles a seed must travel from its parent. Prevents seeds from piling up directly beneath the plant.',
    min: 1,
    max: 20,
    step: 1,
    unit: ' tiles',
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
    key: 'maxSpawners',
    group: 'creatures',
    label: 'Max spawners',
    help: 'Hard cap on placed creature generators. Reached cap silently ignores new placements.',
    min: 1,
    max: 100,
    step: 1,
    type: 'range',
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
    key: 'lifespanScale',
    group: 'creatures',
    label: 'Lifespan multiplier',
    help: 'Scales every creature\'s lifespan. 2× means a species that would normally live 300 s now lives 600 s. Individual creatures still inherit and evolve their own lifespan trait on top of this.',
    min: 0.25,
    max: 10,
    step: 0.25,
    unit: '×',
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
    key: 'hungerRateScale',
    group: 'creatures',
    label: 'How quickly creatures get hungry',
    help: 'A multiplier on every species\' hunger rate. At 0, hunger is turned off entirely — animals never starve, so food stops mattering. At 2 they drain twice as fast; boom-and-crash cycles run on a tighter clock.',
    min: 0,
    max: 4,
    step: 0.05,
  },
  {
    key: 'mealValue',
    group: 'creatures',
    label: 'How filling a meal is',
    help: 'How much of an empty stomach one bite fills. If this exceeds the breed cost, well-fed animals will breed on every meal — which can overshoot the plant supply quickly.',
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
    key: 'diseaseSpreadChance',
    group: 'creatures',
    label: 'Disease spread chance',
    help: 'How likely a sick creature is to infect a healthy neighbour each tick. Set to 0 to disable disease entirely.',
    min: 0,
    max: 0.5,
    step: 0.005,
  },
  {
    key: 'diseaseDuration',
    group: 'creatures',
    label: 'Disease duration',
    help: 'How long an animal stays sick after catching something.',
    min: 1,
    max: 120,
    step: 1,
    unit: 's',
  },
  {
    key: 'migrationThreshold',
    group: 'world',
    label: 'Time before animals migrate',
    help: 'How many seconds a hungry creature searches its home range before giving up and moving toward greener terrain. Lower values make populations more nomadic.',
    min: 15,
    max: 300,
    step: 5,
    unit: 's',
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
  {
    key: 'currentX',
    group: 'world',
    label: 'Water current — left/right',
    help: 'A directional push through all liquid. Positive flows rightward, negative leftward. Swimmers and drifters are carried; walkers ignore it.',
    min: -3,
    max: 3,
    step: 0.1,
  },
  {
    key: 'currentY',
    group: 'world',
    label: 'Water current — up/down',
    help: 'Vertical component of the water current. Positive sinks, negative lifts. A downward current in a deep lake tests whether your fish can fight it.',
    min: -3,
    max: 3,
    step: 0.1,
  },
  {
    key: 'seasonAmplitude',
    group: 'world',
    label: 'Seasons — strength',
    help: 'A slow cycle that swings how fast plants grow and spread. At 0 there are no seasons. At 0.7, plants thrive in summer (×1.7 rate) and barely survive winter (×0.3 rate). At 1 they go dormant entirely in the trough.',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'seasonPeriod',
    group: 'world',
    label: 'Seasons — cycle length (sim seconds)',
    help: 'How long one full season cycle takes in simulation time. 300 is about five real minutes at normal speed. Shorter periods make the world feel more volatile; longer ones feel geological.',
    min: 30,
    max: 1800,
    step: 30,
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

function clampKnob(key: TuningKey, value: number): number {
  const knob = KNOB_BY_KEY[key]
  if (!knob || !Number.isFinite(value)) return TUNING_DEFAULTS[key]
  const clamped = Math.max(knob.min, Math.min(knob.max, value))
  // Integer steps mean integer values: a batch of 2.6 sprouts is a rounding
  // decision made somewhere further down, where nobody can see it.
  return knob.step >= 1 ? Math.round(clamped) : clamped
}

/**
 * How far under the breed cost a meal is held.
 *
 * Small on purpose. This is a floor on the gap, not a target for it — the
 * shipped pair sits exactly this far apart, and anything wider is a balance
 * decision rather than a safety one.
 */
export const MEAL_HEADROOM = 0.05

/**
 * The one relationship between two knobs that the world cannot survive.
 *
 * If a meal more than pays for a child, grazers breed on every full stomach,
 * overshoot the plants, and take the entire food chain down with them. Both
 * numbers are sliders, so this cannot be left as something the defaults merely
 * happen to satisfy — a player dragging either one past the other would do it
 * in a single notch, and the collapse arrives a minute later looking like the
 * ecosystem's fault rather than the slider's.
 *
 * Whichever knob moved is the one that gets respected: pushing the meal up
 * carries the cost up ahead of it, and pulling the cost down drags the meal
 * down with it, so neither edit is silently ignored. `moved` names the keys the
 * caller actually set; without it, dragging one would be indistinguishable from
 * dragging the other and one of the two sliders would feel stuck.
 */
function enforceInvariants(moved: Set<TuningKey>): void {
  if (TUNING.mealValue < TUNING.breedCost) return
  if (moved.has('mealValue')) {
    TUNING.breedCost = clampKnob('breedCost', TUNING.mealValue + MEAL_HEADROOM)
    // The cost has a ceiling of its own, so a meal dragged to the very top can
    // still end up level with it. Give way in the other direction rather than
    // leaving the pair inverted.
    if (TUNING.mealValue >= TUNING.breedCost) {
      TUNING.mealValue = clampKnob('mealValue', TUNING.breedCost - MEAL_HEADROOM)
    }
    return
  }
  TUNING.mealValue = clampKnob('mealValue', TUNING.breedCost - MEAL_HEADROOM)
}

/** Move one or more knobs. Values outside a knob's range are clamped, not rejected. */
export function setTuning(patch: Partial<Tuning>): void {
  const moved = new Set<TuningKey>()
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in TUNING_DEFAULTS)) continue
    TUNING[key as TuningKey] = clampKnob(key as TuningKey, value as number)
    moved.add(key as TuningKey)
  }
  enforceInvariants(moved)
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
