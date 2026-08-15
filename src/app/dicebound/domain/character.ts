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
  /**
   * True when this rank was handed over at creation rather than earned in play.
   *
   * `startingSkills` seeds up to three skills at rank 1 for writing a sentence,
   * and level is meant to be a record of what the character actually did — so
   * the seeded rank has to be distinguishable from the identical-looking rank
   * the next character ground out over three real checks. Optional rather than
   * always-present because a character saved before this marker existed has to
   * keep reading as valid; see `earnedRanks` for what absent means.
   */
  seeded?: true
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

/**
 * How many skills a sentence may be worth at creation.
 *
 * Three, and enforced here rather than asked for in the prompt, for the same
 * reason the attribute budget is: a model in a generous mood will hand out six,
 * and a character who starts good at six things has spent the interesting part
 * of the game before the first turn. The model proposes; this decides how many.
 */
export const MAX_STARTING_SKILLS = 3

/**
 * Turn the skills a creation model proposed into real records.
 *
 * Each is seeded at the first rank threshold rather than at zero uses. That is
 * the difference between "you start at rank 1" and "you start at rank 1 and the
 * next time you use it, it drops back to where an untrained character would
 * be" — `rankFor` is the authority on rank, so a record whose `uses` disagrees
 * with its `rank` is a record that will silently correct itself downward the
 * first time the skill comes up. Seeding at the threshold makes the stored rank
 * one `rankFor` already agrees with, and the next use counts toward rank 2
 * instead of starting the climb over.
 *
 * Innate skills are dropped rather than granted. `size` and `looks` are set
 * separately and describe what the character *is*; letting them also be spent
 * out of the starting budget would mean a very small character got fewer things
 * they are good at as a consequence of being described accurately.
 */
export function startingSkills(proposed: unknown): Partial<Record<SkillId, SkillRecord>> {
  if (!Array.isArray(proposed)) return {}

  const out: Partial<Record<SkillId, SkillRecord>> = {}
  for (const value of proposed) {
    if (!isSkillId(value)) continue
    if (SKILLS[value].innate) continue
    // Deduped by construction: a model naming the same skill twice should not
    // consume two of the three slots.
    if (out[value]) continue
    if (Object.keys(out).length >= MAX_STARTING_SKILLS) break

    // Marked as seeded, permanently. The rank is real — it adds to every check
    // from turn one — but it is not an achievement, and `earnedRanks` subtracts
    // it back out so that a character who has written a sentence and nothing
    // else is level 1.
    out[value] = { uses: RANK_THRESHOLDS[0], rank: 1, seeded: true }
  }

  return out
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
      // `before` is spread rather than rebuilt so the seeded marker survives
      // being used. Rebuilding the record from `{ uses, rank }` would clear it
      // on the first check, and the head start would quietly become an
      // achievement the moment the player touched the skill.
      skills: { ...character.skills, [skill]: { ...before, uses, rank } },
    },
    earned: rank > before.rank ? { skill, rank } : null,
  }
}

/**
 * Ranks the character earned by playing — the number level is computed from.
 *
 * Three things are deliberately excluded, and each was a way of being handed a
 * level rather than reaching one.
 *
 * Negative ranks do not subtract. An innate Size of −2 is mechanically real on
 * every Size check, but it is something the character *is*, not something they
 * failed to achieve, and letting it drag on level would mean a small character
 * levelled more slowly for having been described accurately at creation.
 *
 * Seeded ranks do not count. `startingSkills` grants up to three of them for
 * writing a sentence, and counting them made `levelFor` return 2 for a
 * character who had not yet rolled a die — which made tier 1 powers grantable
 * on turn 1 and fired class discovery on a histogram containing nothing but
 * the three skills the player was handed at the door.
 *
 * A seeded skill that grows in play earns the difference: rank 2 on a seeded
 * skill is one earned rank, the same as rank 1 on a skill nobody gave you. The
 * head start is not taxed twice.
 *
 * **Migration.** A record saved before the marker existed has no `seeded`, and
 * is read as earned. That is knowingly generous to the handful of live
 * campaigns — the alternative is every existing player losing a level on
 * deploy, which is a worse thing to be right about.
 */
export function earnedRanks(character: Character): number {
  return Object.values(character.skills).reduce((sum, record) => {
    if (!record) return sum
    const rank = Math.max(0, record.rank)
    return sum + Math.max(0, rank - (record.seeded ? 1 : 0))
  }, 0)
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
