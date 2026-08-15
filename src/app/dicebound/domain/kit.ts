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
import { PLAYER_ID, openThreads } from './world'

import type { AttributeId, SkillId } from './attributes'
import type { AdvantageSource, Modifier } from './dice'
import type { EntityId, World } from './world'

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

/**
 * How good a thing is, and what that is worth.
 *
 * The model picks the band; this decides the numbers. That is the same split
 * `roll_check` runs on, and it matters more here than it looks: an item is
 * permanent, so a model allowed to write its own bonus is a model writing a
 * bonus onto every future roll.
 *
 * Adapted from `tap-tap-adventure`'s rarity table, which has the right instinct
 * — common is 55% of drops and its multiplier is 1.0 — but the wrong vocabulary.
 * "Epic" and "legendary" are loot-game words and this is a game about a story,
 * so the bands are named the way a person at the table would describe a thing
 * they were handed.
 *
 * **Most items are +0.** A rope is not a bonus, it is a permission: it turns
 * "you cannot climb that" into a DC 15. If every item were +1 then a
 * well-packed character would stop rolling, which is the failure this whole
 * table exists to prevent. Rarity mostly buys *more traits* — more situations
 * the thing is good in — rather than a bigger number in any one of them.
 */
export type Quality = 'plain' | 'fine' | 'remarkable' | 'storied'

export const QUALITIES: readonly Quality[] = ['plain', 'fine', 'remarkable', 'storied']

export const QUALITY_BANDS: Record<Quality, { bonus: number; traits: number }> = {
  plain: { bonus: 0, traits: 1 },
  fine: { bonus: 1, traits: 1 },
  remarkable: { bonus: 1, traits: 2 },
  storied: { bonus: 2, traits: 2 },
}

export const FALLBACK_SPECIES: Species[] = [
  {
    name: 'Stray',
    note: 'grew up learning to read rooms quickly',
    trait: { label: 'reads a room before they walk into one', bonus: 1, applies: { attributes: ['wisdom'] } },
    drawback: { label: 'slow to trust anyone new', bonus: -1, applies: { attributes: ['charm'] } },
  },
  {
    name: 'Wanderer',
    note: 'spent years moving through unfamiliar places',
    trait: { label: 'finds the way even without a map', bonus: 1, applies: { attributes: ['wisdom'] } },
    drawback: { label: 'never quite settles', bonus: -1, applies: { attributes: ['constitution'] } },
  },
  {
    name: 'Scrapper',
    note: 'learned early that things do not come easily',
    trait: { label: 'keeps going when others stop', bonus: 1, applies: { attributes: ['constitution'] } },
    drawback: { label: 'poor at asking for help', bonus: -1, applies: { attributes: ['charm'] } },
  },
]

/**
 * Levels. `1 + earned ranks / 3` — ranks are earned on use, so level cannot be
 * granted. Feed this `earnedRanks(character)` and nothing else: it counts only
 * ranks reached in play, and the three a sentence buys at creation do not
 * count. Summing raw ranks instead makes a character level 2 before their
 * first roll, which makes a tier 1 power grantable on turn 1.
 */
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

/**
 * Refill the powers that refresh on this boundary, and only those.
 *
 * Two boundaries exist and they are deliberately different sizes. A rest is
 * something a character can decide to have; a chapter is something the story
 * does to them. A tier 3 power with one charge is meant to be the second kind —
 * if a rest brought it back, "once a chapter" would be a label rather than a
 * cost, and the whole reason the tier table is shaped the way it is would stop
 * biting.
 *
 * Defaults to `'rest'` because that is what nearly every power does and because
 * the previous signature took no argument at all: an existing call that has not
 * been updated keeps meaning exactly what it used to.
 */
export function restore(kit: Kit, boundary: Refresh = 'rest'): Kit {
  return {
    ...kit,
    powers: kit.powers.map(power =>
      power.refresh === boundary
        ? { ...power, charges: { ...power.charges, now: power.charges.max } }
        : power
    ),
  }
}

/**
 * How many charges came back, so the turn can say so only when it should.
 *
 * A rest that restored nothing — because nothing was spent, or because
 * everything spent refreshes on a chapter instead — must not produce a line
 * telling the player their powers returned. Counting is cheaper than making
 * every caller diff two kits, and it keeps "did anything happen" out of the
 * rendering.
 */
export function chargesRestored(before: Kit, after: Kit): number {
  const was = new Map(before.powers.map(power => [power.id, power.charges.now]))
  return after.powers.reduce(
    (sum, power) => sum + Math.max(0, power.charges.now - (was.get(power.id) ?? power.charges.now)),
    0
  )
}

// -------------------------------------------------------------- validation

export function validateApplicability(value: unknown): Applicability {
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

// ------------------------------------------------------------ carrying things

/** One item as the dungeon master proposes it, before code prices it. */
export interface ItemGrant {
  id?: unknown
  name?: unknown
  note?: unknown
  quality?: unknown
  origin?: unknown
  consumable?: unknown
  uses?: unknown
  traits?: unknown
}

/**
 * Turn a proposed item into a carried one.
 *
 * The model says what the thing is, what it is good for, and roughly how good.
 * Every number comes from here: the bonus off the quality band, how many traits
 * survive, how many uses a consumable gets. A model that wrote its own bonus
 * would be writing a modifier onto every future roll, which is the one thing
 * the whole architecture is arranged to prevent.
 *
 * `now` is the clock minute, passed in rather than read, so this stays pure.
 */
export function itemFromGrant(grant: ItemGrant, now: number): Item | null {
  const id = slug(grant.id)
  const name = str(grant.name, 80).trim()
  // No id and no name is not an item, it is a sentence. Dropped rather than
  // repaired: an item nobody can name is one the DM can never call on again.
  if (!id || !name) return null

  const quality = oneOf(grant.quality, QUALITIES, 'plain')
  const band = QUALITY_BANDS[quality]

  const proposed = Array.isArray(grant.traits) ? grant.traits : []
  const traits: Trait[] = proposed
    .filter(isPlainObject)
    .slice(0, band.traits)
    .map(raw => ({
      label: str(raw.label, 80).trim() || name,
      // The band decides, not the proposal. A trait the model wanted at +2 on a
      // plain item is worth +0, and the player still sees it named on the die
      // card — the reason is real even when the number is nothing.
      bonus: band.bonus,
      applies: validateApplicability(raw.applies),
    }))
    .filter(trait => trait.label.length > 0)

  const consumable = bool(grant.consumable)
  const uses = boundedInt(grant.uses, 1, 9, 1)

  return {
    id,
    name,
    note: str(grant.note, 240),
    traits,
    ...(consumable ? { charges: { now: uses, max: uses } } : {}),
    consumable,
    origin: slug(grant.origin) || null,
    gainedAt: Math.max(0, now),
  }
}

/**
 * Add an item to a pack that may already be full.
 *
 * Slots, not weight: twelve, because a limit that forces a choice makes a story
 * and a limit that requires arithmetic does not. A full pack refuses the new
 * thing rather than silently dropping something the player was carrying — being
 * told "you have no room" is a decision handed back to them, and waking up to
 * find your rope gone is a bug as far as anyone at the table can tell.
 */
export function addItem(kit: Kit, item: Item): { kit: Kit; added: boolean } {
  const existing = kit.items.findIndex(held => held.id === item.id)
  if (existing !== -1) {
    const items = [...kit.items]
    items[existing] = item
    return { kit: { ...kit, items }, added: true }
  }

  if (kit.items.length >= MAX_ITEMS) return { kit, added: false }
  return { kit: { ...kit, items: [...kit.items, item] }, added: true }
}

/**
 * What the named items are worth on this particular check.
 *
 * The DM says *that the rope applies*; this says what the rope is worth, which
 * is usually nothing. Three rules do the work.
 *
 * A trait only counts where it claims to count. An item good at seeing does not
 * help you lift, and the applicability check here is the same discipline
 * `applicableSkill` enforces for skills — a mismatch is dropped silently rather
 * than refused, because the check should still happen.
 *
 * A trait with an empty applicability applies to everything. That is deliberate
 * and it is why `plain` exists: a rope that is good in general is good for +0.
 *
 * The total is capped at `KIT_BONUS_CAP`, separately from the ±6 situational
 * budget. Situational modifiers come and go with the scene; a pack is
 * permanent, so without its own ceiling a well-equipped character stops rolling
 * altogether.
 */
export function kitModifiers(
  kit: Kit,
  named: unknown,
  attribute: AttributeId,
  skill: SkillId | null
): { label: string; value: number }[] {
  if (!Array.isArray(named)) return []

  const wanted = new Set(named.map(id => slug(id)).filter(Boolean))
  const out: { label: string; value: number }[] = []

  for (const item of kit.items) {
    if (!wanted.has(item.id)) continue
    // A consumable with nothing left is a thing you are still carrying and can
    // no longer use. It stays in the pack; it just stops helping.
    if (item.charges && item.charges.now <= 0) continue

    for (const trait of item.traits) {
      if (trait.bonus === 0) continue
      if (!traitApplies(trait, attribute, skill)) continue
      out.push({ label: trait.label, value: trait.bonus })
    }
  }

  // Species applies automatically — no id required.
  // The trait and the drawback both count, on every check they apply to.
  if (kit.species) {
    const { trait, drawback } = kit.species
    if (traitApplies(trait, attribute, skill)) {
      out.push({ label: trait.label, value: trait.bonus })
    }
    if (traitApplies(drawback, attribute, skill)) {
      out.push({ label: drawback.label, value: drawback.bonus })
    }
  }

  return capKit(out)
}

function traitApplies(trait: Trait, attribute: AttributeId, skill: SkillId | null): boolean {
  return appliesTo(trait.applies, attribute, skill)
}

/**
 * Does a claim about where something applies cover this particular check?
 *
 * Shared by item traits and by powers, because they are the same question asked
 * about the same two fields. An empty claim covers everything, deliberately —
 * that is why a rope that is good in general is good for +0, and why a power
 * that names nothing applies wherever the fiction says it does.
 */
export function appliesTo(
  applies: Applicability,
  attribute: AttributeId,
  skill: SkillId | null
): boolean {
  const { attributes, skills } = applies
  const claimsSomething = (attributes?.length ?? 0) > 0 || (skills?.length ?? 0) > 0
  if (!claimsSomething) return true

  if (attributes?.includes(attribute)) return true
  if (skill && skills?.includes(skill)) return true
  return false
}

/**
 * Hold the set under the ceiling without hiding any of it.
 *
 * Trimmed from the smallest upward rather than truncated, so the thing the
 * player thought was helping most still appears on the die card. A card that
 * silently omits a reason teaches the player that the fiction does not affect
 * the odds, which is the opposite of what it is for.
 */
function capKit(modifiers: { label: string; value: number }[]): { label: string; value: number }[] {
  const total = modifiers.reduce((sum, m) => sum + m.value, 0)
  if (Math.abs(total) <= KIT_BONUS_CAP) return modifiers

  const ordered = [...modifiers].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const kept: { label: string; value: number }[] = []
  let running = 0
  let capped = false

  for (const modifier of ordered) {
    if (capped) {
      kept.push({ label: modifier.label, value: 0 })
      continue
    }
    const next = running + modifier.value
    if (Math.abs(next) > KIT_BONUS_CAP) {
      const room = KIT_BONUS_CAP - Math.abs(running)
      if (room <= 0) {
        kept.push({ label: modifier.label, value: 0 })
        capped = true
        continue
      }
      const trimmed = modifier.value > 0 ? room : -room
      kept.push({ label: modifier.label, value: trimmed })
      running += trimmed
      capped = true
    } else {
      kept.push(modifier)
      running = next
    }
  }

  return kept
}

/**
 * Whether the fiction may hand this power over, and what it is actually worth.
 *
 * A verdict rather than a throw, and a *reason* rather than a boolean, because
 * every one of these refusals happens in ordinary play. The DM asks for
 * something the character is not ready for, or names a teacher the story has
 * not introduced, or grants the same trick twice under a second name. None of
 * that is an error — the turn carries on, the DM narrates around it, and the
 * player never learns a tool call was rejected.
 *
 * The reason is written to be read by the model, because a refusal it cannot
 * understand is a refusal it will simply repeat next turn.
 */
export interface PowerVerdict {
  granted: boolean
  /** Addressed to the DM. Always set, on a grant as well as a refusal. */
  reason: string
  /** The tier it may actually have — clamped down, never up. Zero when refused. */
  tier: number
}

/**
 * Has the player actually encountered this?
 *
 * The gate with judgement in it, so it is written down rather than left to the
 * next reader to infer. Three conditions, and each one closes a different door:
 *
 * The entity must **exist in the graph**. That is invariant 12 doing its work —
 * a power must come from something the world already knows about, and "nothing"
 * fails a lookup. An id the model minted while writing this turn is not in the
 * graph, so it fails here without needing a rule of its own.
 *
 * It must not be `gone`. A teacher who is dead and a vault that has collapsed
 * are both still in the graph, deliberately, because the story remembers them —
 * but neither can hand anything over now.
 *
 * It must **predate this turn**. This is the same rule `Edge.since` enforces for
 * relationship bonuses, and for the same reason: without it the DM could
 * introduce a mysterious stranger and have them teach fireball in the same
 * breath, which is granting a power to yourself with extra steps. `firstSeen`
 * is a clock minute, and `turnStartedAt` is the clock as it stood before this
 * turn touched anything.
 *
 * `you` is excluded on purpose. A power sourced from the player is a power with
 * no provenance wearing an id that happens to resolve.
 */
export function hasMet(world: World, id: EntityId, turnStartedAt: number): boolean {
  if (!id || id === PLAYER_ID) return false
  const entity = world.entities[id]
  if (!entity) return false
  if (entity.status === 'gone') return false
  return entity.firstSeen < turnStartedAt
}

export function canGrantPower(
  kit: Kit,
  world: World,
  level: number,
  proposal: { id: string; source: string; tier: unknown },
  turnStartedAt: number
): PowerVerdict {
  const id = slug(proposal.id)
  const source = slug(proposal.source)

  if (!id) {
    return {
      granted: false,
      reason: 'That did not name a power anyone could call on again.',
      tier: 0,
    }
  }

  // Checked before the slot, so a power they already have reads as "they
  // already have it" rather than as "the pack is full".
  if (kit.powers.some(power => power.id === id)) {
    return {
      granted: false,
      reason: `They already have ${id}. If this is meant to be something new, it needs a different name and a different id.`,
      tier: 0,
    }
  }

  const ceiling = maxTierAt(level)
  if (ceiling === 0) {
    return {
      granted: false,
      reason: `At level ${level} they are not yet someone who has powers. Let the moment happen in the fiction without one — they will be ready sooner than you think.`,
      tier: 0,
    }
  }

  if (!hasMet(world, source, turnStartedAt)) {
    return {
      granted: false,
      reason: `A power has to come from something the story already contains, and "${source || 'nothing'}" is not something they have met. Introduce it first, in its own scene, and it can hand this over later.`,
      tier: 0,
    }
  }

  const slots = Math.min(maxPowersAt(level), MAX_POWERS)
  if (kit.powers.length >= slots) {
    return {
      granted: false,
      reason: `They are holding ${kit.powers.length} powers, which is all a level ${level} character may carry. Nothing is added.`,
      tier: 0,
    }
  }

  // Clamped down, never up. That is the whole difference between the model
  // describing something impressive and the model pricing it: a DM that wants
  // the player to have a tier 3 power says "tier 3", and the answer is the tier
  // their level actually allows.
  const tier = Math.min(boundedInt(proposal.tier, MIN_TIER, MAX_TIER, MIN_TIER), ceiling)
  return { granted: true, reason: '', tier }
}

/**
 * Build the power, with every number coming from here.
 *
 * The model supplies the name, the note, the shape, what it permits or where it
 * applies, the cost and the source. It supplies no magnitudes at all: the tier
 * arrives already clamped by `canGrantPower`, the charges come from
 * `TIER_CHARGES`, and `gainedAt` comes from the clock.
 */
export function powerFromGrant(
  grant: Record<string, unknown>,
  tier: number,
  now: number
): Power | null {
  const id = slug(grant.id)
  const name = str(grant.name, 80).trim()
  const source = slug(grant.source)
  if (!id || !name || !source) return null

  const max = TIER_CHARGES[tier] ?? 1

  return {
    id,
    name,
    note: str(grant.note, 240),
    tier,
    shape: oneOf(grant.shape, POWER_SHAPES, 'permits'),
    permits: str(grant.permits, 160),
    applies: validateApplicability(grant.applies),
    charges: { now: max, max },
    // Fixed by tier, not chosen. A model asked how often its own power should
    // come back has one answer, and it is "often".
    refresh: tier >= MAX_TIER ? 'chapter' : 'rest',
    cost: str(grant.cost, 160),
    source,
    gainedAt: Math.max(0, now),
  }
}

/**
 * Add a power to a character who has room for it.
 *
 * Deliberately dumber than `addItem`, which replaces a held item of the same id
 * so a re-granted rope is refreshed rather than duplicated. A power is not a
 * thing you can be handed twice — re-granting one would silently restore its
 * charges, which is a rest the player did not take. `canGrantPower` refuses the
 * duplicate before it reaches here; this is the second lock on the same door.
 */
export function addPower(kit: Kit, power: Power): { kit: Kit; added: boolean } {
  if (kit.powers.some(held => held.id === power.id)) return { kit, added: false }
  if (kit.powers.length >= MAX_POWERS) return { kit, added: false }
  return { kit: { ...kit, powers: [...kit.powers, power] }, added: true }
}

/** What spending a charge produced: the power, or the reason there is none. */
export interface PowerSpend {
  kit: Kit
  /** Null when nothing was spent — see `reason`. */
  power: Power | null
  /** Addressed to the DM, on a spend as well as a refusal. */
  reason: string
}

/**
 * Spend a charge, and spend it whether or not anything comes of it.
 *
 * This is the rule the whole epic rests on, expressed as an ordering: the
 * charge goes **first**, before any check is rolled and without knowing whether
 * one will land. A power that only costs you something when it works is not a
 * choice, it is a bonus with ceremony — and the moment using a power is free on
 * a miss, the interesting question ("is this the moment?") stops being a
 * question at all.
 *
 * Nothing here decides an outcome. It returns the power so the caller can turn
 * it into a permission or into advantage; it never returns a modifier, and it
 * never touches the die.
 *
 * `spentThisTurn` is passed in rather than tracked here because the domain has
 * no idea what a turn is. Without it a model that liked the answer could spend
 * the same power three times in one message and pay for it once.
 */
export function spendPower(
  kit: Kit,
  id: unknown,
  spentThisTurn: ReadonlySet<string> = new Set()
): PowerSpend {
  const wanted = slug(id)
  if (!wanted) return { kit, power: null, reason: 'That did not name a power.' }

  const held = kit.powers.find(power => power.id === wanted)
  // Refused, not invented. A power the character does not have is not a power
  // they can use, however good the moment for it looks.
  if (!held) {
    return {
      kit,
      power: null,
      reason: `They cannot do that. ${wanted} is not something they have. Narrate the moment without it.`,
    }
  }

  if (spentThisTurn.has(wanted)) {
    return {
      kit,
      power: null,
      reason: `${held.name} has already been used this turn. Once is all they get.`,
    }
  }

  if (held.charges.now <= 0) {
    return {
      kit,
      power: null,
      reason: `${held.name} is spent — no charges left, and they do not come back ${held.refresh === 'rest' ? 'until they rest properly' : 'until the next chapter'}. Narrate them reaching for it and finding nothing there.`,
    }
  }

  // Floored, not merely decremented. `validatePower` re-derives `max` on the
  // way in but nothing re-derives `now`, so the floor has to be enforced at the
  // one place that moves it.
  const spent: Power = {
    ...held,
    charges: { ...held.charges, now: Math.max(0, held.charges.now - 1) },
  }

  return {
    kit: { ...kit, powers: kit.powers.map(power => (power.id === wanted ? spent : power)) },
    power: spent,
    reason: '',
  }
}

/**
 * What a spent power leaves on the table — and notably, what it does not.
 *
 * Neither branch is an outcome and neither is a magnitude the model chose. A
 * `permits` power becomes a die-card row worth exactly **+0**: the capability
 * is named, because the reason is real even when the number is nothing
 * (invariant 18), and the check still has to be rolled at whatever DC the
 * fiction sets. An `advantage` power becomes a flag with no number in it at
 * all.
 *
 * This is a function rather than two lines at the call site so that the one
 * thing worth protecting — *a power never resolves an outcome* — is somewhere a
 * test can point at. The bonus is a literal zero here on purpose. If a later
 * change ever wants it to be otherwise, it has to edit this line and explain
 * itself, rather than quietly adding a number where the model was passing one
 * through.
 */
export interface PowerEffect {
  /** A +0 row for the die card, for a `permits` power. */
  permission: Modifier | null
  /** A flag for the next matching check, for an `advantage` power. */
  advantage: { source: AdvantageSource; applies: Applicability } | null
}

export function powerEffect(power: Power): PowerEffect {
  if (power.shape === 'advantage') {
    return {
      permission: null,
      advantage: {
        source: { direction: 'advantage', reason: power.name },
        applies: power.applies,
      },
    }
  }

  return {
    permission: {
      label: power.permits ? `${power.name} — ${power.permits}` : power.name,
      value: 0,
    },
    advantage: null,
  }
}

export interface RestResult {
  kit: Kit
  /** True when the span qualified as a rest, whether or not anything refilled. */
  rested: boolean
  /** Charges that actually came back. Zero means the turn should say nothing. */
  restored: number
}

/**
 * Decide whether the span that just passed was a rest, and refill if it was.
 *
 * Three conditions, and the point of there being three is that the model
 * controls at most two of them. It reports `elapsed` and it reports `safe` —
 * both already constrained elsewhere, since `advance` will not step a fuse and
 * the clock is the server's. The third it cannot touch at all: an open thread
 * at `urgent` pressure is a fact about the graph, not a claim, so a DM cannot
 * declare a peaceful evening while the thing chasing the player is one scene
 * away.
 *
 * The world is read **after** the turn's deltas on purpose. A thread that fired
 * during the span is exactly the case a rest must not survive, and reading the
 * world as it stood before the turn would miss it.
 *
 * One qualifying span refills once. A week of travel is not seven rests — this
 * is called once for the turn, and `rested` is what the caller latches so a
 * turn that narrates twice cannot rest twice.
 */
export function restFor(kit: Kit, world: World, minutesElapsed: number, safe: boolean): RestResult {
  const urgent = openThreads(world).some(thread => thread.pressure === 'urgent')
  if (!isRest(minutesElapsed, safe, urgent)) return { kit, rested: false, restored: 0 }

  const next = restore(kit, 'rest')
  return { kit: next, rested: true, restored: chargesRestored(kit, next) }
}
