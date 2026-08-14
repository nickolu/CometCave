/**
 * What the character carries, what they can do, and what they are.
 *
 * Three primitives, and everything phase 2 adds is a package of them with a name
 * on it — species, classes, spells and equipment all compile down to this, so
 * the resolver never learns any of them exist.
 *
 *   Trait   always-on, conditional, ±1 or ±2
 *   Item    a carried thing holding 0–2 traits
 *   Power   costs a charge; either *permits* something or grants *advantage*
 *
 * Two rules here matter more than the shapes:
 *
 * **Most items are +0.** A rope is not a bonus, it is a permission — it turns
 * "you can't" into a DC 15. If every item carries a +1, a well-packed character
 * stops rolling, and the die is the game.
 *
 * **A power never resolves an outcome, it only makes one available.** Fireball
 * does not kill the guard; it turns "you cannot hurt him from here" into a Power
 * check that can still miss. That is the only reason abilities can be added
 * without touching `dice.ts` at all.
 */
import { isAttributeId, isSkillId } from './attributes'
import { bool, boundedInt, isPlainObject, oneOf, slug, str } from './validate'

import type { AttributeId, SkillId } from './attributes'
import type { EntityId } from './world'

/** When a trait or power applies. Empty means "the DM decides, in the fiction". */
export interface Applicability {
  attributes?: AttributeId[]
  skills?: SkillId[]
}

export const MAX_TRAIT = 2

export interface Trait {
  /** Shown on the die card exactly as written: "the lantern is lit". */
  label: string
  /** −2..+2. Assigned by code from a quality band, never by the model. */
  bonus: number
  applies: Applicability
}

export const MAX_ITEMS = 12
export const MAX_POWERS = 6

export interface Charges {
  now: number
  max: number
}

export interface Item {
  id: string
  name: string
  note: string
  traits: Trait[]
  /** Present only for things with a limited number of uses. */
  charges?: Charges
  consumable: boolean
  /** The world entity this came from, when it came from one. */
  origin: EntityId | null
  /** Clock minute it was acquired. */
  gainedAt: number
}

export type PowerShape = 'permits' | 'advantage'
export const POWER_SHAPES: readonly PowerShape[] = ['permits', 'advantage']

export type Refresh = 'rest' | 'chapter'
export const REFRESHES: readonly Refresh[] = ['rest', 'chapter']

export const MIN_TIER = 1
export const MAX_TIER = 3

/** Charges and refresh are fixed by tier in code. The model names things; it does not price them. */
export const TIER_CHARGES: Record<number, number> = { 1: 3, 2: 2, 3: 1 }

/** The level at which each tier becomes reachable. A starting guess, expected to move. */
export const TIER_LEVELS: Record<number, number> = { 1: 2, 2: 4, 3: 7 }

export interface Power {
  id: string
  name: string
  /** What it looks like when used. */
  note: string
  tier: number
  shape: PowerShape
  /** For `permits`: the capability, in plain language. "throw fire, at range" */
  permits: string
  /** For `advantage`: where the 2d20 applies. */
  applies: Applicability
  charges: Charges
  refresh: Refresh
  /** The price, if it has one. */
  cost: string
  /**
   * Provenance, and the reason this field is not optional.
   *
   * A power must come from something the world already knows about — a person
   * who taught you, a thing you found, a place that changed you. The DM cannot
   * conjure fireball out of nothing, because "nothing" fails a lookup. This is
   * where the world graph earns its keep mechanically rather than decoratively.
   */
  source: EntityId
  gainedAt: number
}

export interface Species {
  name: string
  note: string
  trait: Trait
  /**
   * The cost of being this.
   *
   * Not flavour. A package that is purely upside reads as a reward rather than
   * as something true about you, and species without a cost is a stat bonus
   * wearing a name. `tap-tap-adventure`'s items carry a drawback for the same
   * reason.
   */
  drawback: Trait
}

export interface Kit {
  items: Item[]
  powers: Power[]
  species: Species | null
  /** Discovered at level 2 from what the character has actually been doing. */
  className: string | null
}

export function emptyKit(): Kit {
  return { items: [], powers: [], species: null, className: null }
}

/**
 * The most that carried gear and standing-in-the-world may add to one check.
 *
 * Separate from the ±6 situational budget in `dice.ts` and deliberately small.
 * Situational modifiers come and go with the scene; kit and relationships are
 * permanent, so without their own ceiling a well-equipped, well-connected
 * character would simply stop rolling.
 */
export const KIT_BONUS_CAP = 3

/** Levels. `1 + earned ranks / 3` — ranks are earned on use, so level cannot be granted. */
export const RANKS_PER_LEVEL = 3
export const MAX_LEVEL = 10

export function levelFor(earnedRanks: number): number {
  return Math.max(
    1,
    Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, earnedRanks) / RANKS_PER_LEVEL))
  )
}

export function maxPowersAt(level: number): number {
  return 1 + Math.floor(Math.max(1, level) / 2)
}

/** The best tier this level may be granted, or 0 when powers are still out of reach. */
export function maxTierAt(level: number): number {
  let best = 0
  for (const tier of [1, 2, 3]) {
    if (level >= TIER_LEVELS[tier]) best = tier
  }
  return best
}

/** Hours of fiction that must pass, safely, before charges come back. */
export const REST_MINUTES = 6 * 60

/**
 * Charges return only when code says the character rested.
 *
 * `refresh: 'rest'` would mean nothing if the model decided what a rest was, so
 * it does not: enough time has to have passed, the turn has to have been flagged
 * safe, and no threat may be pressing. The third condition is the one the model
 * cannot wave away.
 */
export function isRest(minutesElapsed: number, safe: boolean, urgentThreat: boolean): boolean {
  return minutesElapsed >= REST_MINUTES && safe && !urgentThreat
}

export function restore(kit: Kit): Kit {
  return {
    ...kit,
    powers: kit.powers.map(power => ({
      ...power,
      charges: { ...power.charges, now: power.charges.max },
    })),
  }
}

// -------------------------------------------------------------- validation

function validateApplicability(value: unknown): Applicability {
  if (!isPlainObject(value)) return {}

  const attributes = Array.isArray(value.attributes)
    ? value.attributes.filter(isAttributeId).slice(0, 8)
    : []
  const skills = Array.isArray(value.skills) ? value.skills.filter(isSkillId).slice(0, 8) : []

  const applies: Applicability = {}
  if (attributes.length) applies.attributes = attributes
  if (skills.length) applies.skills = skills
  return applies
}

export function validateTrait(value: unknown): Trait | null {
  if (!isPlainObject(value)) return null

  const label = str(value.label, 80).trim()
  if (!label) return null

  return {
    label,
    bonus: boundedInt(value.bonus, -MAX_TRAIT, MAX_TRAIT),
    applies: validateApplicability(value.applies),
  }
}

function validateCharges(value: unknown): Charges | null {
  if (!isPlainObject(value)) return null
  const max = boundedInt(value.max, 0, 9)
  if (max === 0) return null
  return { max, now: boundedInt(value.now, 0, max) }
}

export function validateItem(value: unknown): Item | null {
  if (!isPlainObject(value)) return null

  const id = slug(value.id)
  const name = str(value.name, 80).trim()
  if (!id || !name) return null

  const item: Item = {
    id,
    name,
    note: str(value.note, 240),
    traits: Array.isArray(value.traits)
      ? (value.traits.map(validateTrait).filter(Boolean) as Trait[]).slice(0, 2)
      : [],
    consumable: bool(value.consumable),
    origin: slug(value.origin) || null,
    gainedAt: Math.max(0, boundedInt(value.gainedAt, 0, Number.MAX_SAFE_INTEGER)),
  }

  const charges = validateCharges(value.charges)
  if (charges) item.charges = charges
  return item
}

export function validatePower(value: unknown): Power | null {
  if (!isPlainObject(value)) return null

  const id = slug(value.id)
  const name = str(value.name, 80).trim()
  const source = slug(value.source)
  // No provenance, no power. A power the world cannot account for is exactly
  // the thing this field exists to make impossible, so it is dropped rather
  // than repaired with a placeholder source.
  if (!id || !name || !source) return null

  const tier = boundedInt(value.tier, MIN_TIER, MAX_TIER, MIN_TIER)
  const max = TIER_CHARGES[tier] ?? 1
  const rawNow = isPlainObject(value.charges) ? value.charges.now : undefined

  return {
    id,
    name,
    note: str(value.note, 240),
    tier,
    shape: oneOf(value.shape, POWER_SHAPES, 'permits'),
    permits: str(value.permits, 160),
    applies: validateApplicability(value.applies),
    // `max` is re-derived from the tier rather than read back, so a save that
    // has been edited cannot widen its own charges.
    charges: { max, now: boundedInt(rawNow, 0, max, max) },
    refresh: oneOf(value.refresh, REFRESHES, 'rest'),
    cost: str(value.cost, 160),
    source,
    gainedAt: Math.max(0, boundedInt(value.gainedAt, 0, Number.MAX_SAFE_INTEGER)),
  }
}

export function validateSpecies(value: unknown): Species | null {
  if (!isPlainObject(value)) return null

  const name = str(value.name, 60).trim()
  const trait = validateTrait(value.trait)
  const drawback = validateTrait(value.drawback)
  if (!name || !trait || !drawback) return null

  return {
    name,
    note: str(value.note, 240),
    trait,
    // A drawback that validated as a bonus is a drawback the model got wrong.
    drawback: { ...drawback, bonus: -Math.abs(drawback.bonus) },
  }
}

export function validateKit(value: unknown): Kit {
  if (!isPlainObject(value)) return emptyKit()

  const items = Array.isArray(value.items)
    ? (value.items.map(validateItem).filter(Boolean) as Item[]).slice(0, MAX_ITEMS)
    : []
  const powers = Array.isArray(value.powers)
    ? (value.powers.map(validatePower).filter(Boolean) as Power[]).slice(0, MAX_POWERS)
    : []

  return {
    items,
    powers,
    species: validateSpecies(value.species),
    className: str(value.className, 60).trim() || null,
  }
}
