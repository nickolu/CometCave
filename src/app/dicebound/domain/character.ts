/**
 * The character, and the way it grows.
 *
 * A new sheet has eight attributes and no skills at all. Skills arrive by
 * being used: the dungeon master calls for Balance, the die is rolled, and a
 * counter ticks. Three calls in and Balance appears on the sheet at +1, where
 * it stays and starts adding to every future Balance check.
 *
 * Two decisions in here carry the whole progression:
 *
 * Failing counts. A skill advances on *use*, not on success, because a sheet
 * that only records wins is a sheet that punishes the player for attempting
 * the interesting thing. The character who keeps falling off the log is
 * learning to balance, and after enough falls they stop falling.
 *
 * The DM cannot grant ranks. It picks which skill a moment belongs to and
 * nothing else; the thresholds are here, in code, and they are the same for
 * everyone. Otherwise a generous model hands out +3s in the first ten minutes
 * and the die stops mattering by the second session.
 */
import { ATTRIBUTE_IDS, type AttributeId, SKILLS, type SkillId, isSkillId } from './attributes'

/** Attribute range at creation. Deliberately narrow — the d20 is the drama. */
export const MIN_ATTRIBUTE = -2
export const MAX_ATTRIBUTE = 3

/**
 * The total a fresh character may spend across all eight attributes.
 *
 * Small on purpose. A sentence like "a brilliant, beautiful, unstoppable
 * warrior-genius" should produce someone *pointy*, not someone good at
 * everything, so the budget forces the model to pick what this person is not.
 */
export const ATTRIBUTE_BUDGET = 4

export const MAX_SKILL_RANK = 3

/**
 * Uses required for each rank. Front-loaded: the first rank should arrive
 * inside a player's first session so the mechanic teaches itself, and the
 * third should take a real campaign.
 */
export const RANK_THRESHOLDS: readonly number[] = [3, 8, 18]

export interface SkillRecord {
  uses: number
  rank: number
}

export interface Character {
  name: string
  /** The player's own sentence, kept verbatim — the DM reads it every turn. */
  concept: string
  /** One line the creator wrote about how the sentence became these numbers. */
  reading: string
  attributes: Record<AttributeId, number>
  skills: Partial<Record<SkillId, SkillRecord>>
}

export function blankAttributes(): Record<AttributeId, number> {
  return Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, 0])) as Record<AttributeId, number>
}

/**
 * Force a proposed spread into the rules.
 *
 * The model is asked for numbers in range and on budget and mostly obliges,
 * but "mostly" is not a contract. Each value is clamped, then any overspend is
 * shaved off the highest attributes one point at a time — which preserves the
 * shape of what the model intended (the best thing stays the best thing) while
 * making the budget non-negotiable.
 */
export function normalizeAttributes(
  proposed: Partial<Record<AttributeId, unknown>>
): Record<AttributeId, number> {
  const result = blankAttributes()
  for (const id of ATTRIBUTE_IDS) {
    const raw = proposed[id]
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
    result[id] = Math.max(MIN_ATTRIBUTE, Math.min(MAX_ATTRIBUTE, n))
  }

  let total = ATTRIBUTE_IDS.reduce((sum, id) => sum + result[id], 0)
  while (total > ATTRIBUTE_BUDGET) {
    // Shave the current maximum; ATTRIBUTE_IDS order breaks ties so this is
    // deterministic and therefore testable.
    let highest: AttributeId = ATTRIBUTE_IDS[0]
    for (const id of ATTRIBUTE_IDS) {
      if (result[id] > result[highest]) highest = id
    }
    result[highest] -= 1
    total -= 1
  }

  return result
}

export function rankFor(uses: number): number {
  let rank = 0
  for (const threshold of RANK_THRESHOLDS) {
    if (uses >= threshold) rank += 1
  }
  return Math.min(MAX_SKILL_RANK, rank)
}

/** Uses still needed for the next rank, or null once the skill is maxed. */
export function usesToNextRank(uses: number): number | null {
  const next = RANK_THRESHOLDS[rankFor(uses)]
  return next === undefined ? null : next - uses
}

export function skillRank(character: Character, skill: SkillId | null | undefined): number {
  if (!skill) return 0
  return character.skills[skill]?.rank ?? 0
}

export function attributeRank(character: Character, attribute: AttributeId): number {
  return character.attributes[attribute] ?? 0
}

export interface SkillAdvance {
  skill: SkillId
  rank: number
}

/**
 * Record that a skill was called on, and report a rank if one was just earned.
 *
 * Returns a new character rather than mutating: the caller holds this in a
 * store, and the returned `earned` is what the transcript turns into a visible
 * beat. Innate skills tick their counter but never advance — see `attributes.ts`.
 */
export function recordSkillUse(
  character: Character,
  skill: SkillId
): { character: Character; earned: SkillAdvance | null } {
  if (!isSkillId(skill)) return { character, earned: null }

  const before = character.skills[skill] ?? { uses: 0, rank: 0 }
  const uses = before.uses + 1
  const rank = SKILLS[skill].innate ? before.rank : rankFor(uses)

  return {
    character: {
      ...character,
      skills: { ...character.skills, [skill]: { uses, rank } },
    },
    earned: rank > before.rank ? { skill, rank } : null,
  }
}

/**
 * Total earned skill ranks — the number that level is computed from.
 *
 * Only positive ranks count. An innate Size of −2 is mechanically real on every
 * Size check, but it is something the character *is*, not something they have
 * achieved, and letting it subtract from level would mean a small character
 * levelled more slowly for being described accurately at creation.
 */
export function totalRanks(character: Character): number {
  return Object.values(character.skills).reduce(
    (sum, record) => sum + Math.max(0, record?.rank ?? 0),
    0
  )
}

/** Every skill the character has actually earned, best first. */
export function earnedSkills(character: Character): { skill: SkillId; record: SkillRecord }[] {
  return (
    Object.entries(character.skills)
      .map(([skill, record]) => ({ skill: skill as SkillId, record: record as SkillRecord }))
      // Non-zero, not positive. An innate Size of −2 is as mechanically real as
      // a Balance of +2 — it is added to every Size check — so filtering on
      // `> 0` would apply a penalty the player and the DM could both see the
      // effect of but neither could see the cause of.
      .filter(entry => entry.record.rank !== 0)
      .sort((a, b) => b.record.rank - a.record.rank || b.record.uses - a.record.uses)
  )
}
