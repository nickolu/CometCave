/**
 * Folding a resolved turn back into a campaign.
 *
 * The server decides what happened; this decides what the save file looks like
 * afterwards. It is pure, and it is separate from both the route and the store
 * so the interesting arithmetic — streaks, skill ranks, the running tally of
 * natural 20s — can be tested without a network or a browser.
 */
import { type Character, recordSkillUse } from './character'

import type { Campaign, CampaignStats, CheckEntry, TranscriptEntry } from './campaign'
import type { World } from './world'

/** A tool call as the turn loop sees it: a name, and whatever the model sent. */
export interface ToolCall {
  name: string
  input: unknown
}

export const ROLL_CHECK_TOOL = 'roll_check'
export const NARRATE_TOOL = 'narrate'
export const RECALL_TOOL = 'recall'

/** One pass's tool calls, sorted into what the loop does with each. */
export interface TurnCalls<T extends ToolCall> {
  /** `roll_check` calls, to resolve against the die in the order they arrived. */
  rolls: T[]
  /**
   * `recall` lookups. Answered and the turn continues — a lookup is not a move,
   * so it neither ends the turn nor spends one of its checks.
   */
  recalls: T[]
  /** The `narrate` call that ends the turn, or null while the turn continues. */
  ending: T | null
  /**
   * `narrate` calls that must be answered on the wire but must not be used.
   * The API requires a `tool_result` for every `tool_use` block, so these are
   * replied to and thrown away.
   */
  premature: T[]
}

/**
 * Sort one pass's tool calls into rolls, an ending, and narration to discard.
 *
 * The rule worth protecting is the third bucket. A model may emit `roll_check`
 * and `narrate` in the same response — the tools are offered together, and
 * parallel tool use is the API's default. That narration was composed before
 * the die existed, which is precisely the failure `roll_check` was built to
 * prevent: a difficulty and an outcome chosen in the same breath by something
 * that wants the story to go well. Whether the model *meant* to peek is beside
 * the point. It could not have known the number, so its narration is not about
 * the number, and using it would let the turn resolve without the dice.
 *
 * So a pass with any roll in it never ends. The rolls resolve, the blind
 * narration is answered and dropped, and the model narrates again on the next
 * pass — this time reading a result it cannot edit.
 */
export function partitionTurnCalls<T extends ToolCall>(calls: T[]): TurnCalls<T> {
  const rolls = calls.filter(call => call.name === ROLL_CHECK_TOOL)
  const recalls = calls.filter(call => call.name === RECALL_TOOL)
  const narrations = calls.filter(call => call.name === NARRATE_TOOL)

  // A narration sent alongside a lookup is as blind as one sent alongside a
  // roll: it was written before the answer came back, so whatever the DM asked
  // for cannot be in it.
  if (rolls.length > 0 || recalls.length > 0) {
    return { rolls, recalls, ending: null, premature: narrations }
  }

  // Only the first narration ends the turn. A second one is a duplicate, not a
  // continuation, and appending both would read as the DM saying it twice.
  return { rolls, recalls, ending: narrations[0] ?? null, premature: narrations.slice(1) }
}

/** What a turn produced, before it has been written down anywhere. */
export interface TurnResult {
  entries: TranscriptEntry[]
  /** Set on the opening turn only. */
  title?: string
  /** Set when the turn also condensed old history. */
  synopsis?: string
  /** How many leading transcript entries the synopsis replaced. */
  dropped?: number
  /**
   * The world after the turn's deltas, clock included.
   *
   * Absent on the opening turn and on any path that did not reach a `narrate`
   * — `applyTurn` keeps the campaign's existing world in that case rather than
   * treating a missing field as an emptied graph.
   */
  world?: World
  /**
   * The chapter counter after an archive. Set only on a turn that condensed and
   * successfully wrote what it dropped — a failed archive leaves the counter
   * alone, so the next condense reuses the index and overwrites rather than
   * leaving a gap where a chapter should be.
   */
  chapters?: number
}

export function tallyChecks(stats: CampaignStats, entries: TranscriptEntry[]): CampaignStats {
  const checks = entries.filter((e): e is CheckEntry => e.kind === 'check')
  return {
    turns: stats.turns + 1,
    checks: stats.checks + checks.length,
    successes: stats.successes + checks.filter(c => c.band.endsWith('success')).length,
    naturalTwenties: stats.naturalTwenties + checks.filter(c => c.roll === 20).length,
    naturalOnes: stats.naturalOnes + checks.filter(c => c.roll === 1).length,
  }
}

/**
 * Credit every skill a turn leaned on, and turn any new ranks into beats.
 *
 * The `earned` entries are spliced in immediately after the check that caused
 * them, not appended at the end, so the transcript reads in the order it
 * happened: you go for the jump, you make it, and the sheet quietly notices
 * you have been jumping a lot lately.
 */
export function creditSkills(
  character: Character,
  entries: TranscriptEntry[]
): { character: Character; entries: TranscriptEntry[] } {
  let current = character
  const out: TranscriptEntry[] = []

  for (const entry of entries) {
    out.push(entry)
    if (entry.kind !== 'check' || !entry.skill) continue

    const { character: next, earned } = recordSkillUse(current, entry.skill)
    current = next
    if (earned) out.push({ kind: 'earned', skill: earned.skill, rank: earned.rank })
  }

  return { character: current, entries: out }
}

/**
 * Apply a finished turn to a campaign.
 *
 * `now` is passed in rather than read from the clock so this stays pure. The
 * caller owns time; this owns state.
 */
export function applyTurn(campaign: Campaign, result: TurnResult, now: number): Campaign {
  const { character, entries } = creditSkills(campaign.character, result.entries)

  const kept =
    result.dropped && result.dropped > 0
      ? campaign.transcript.slice(result.dropped)
      : campaign.transcript

  return {
    ...campaign,
    title: result.title ?? campaign.title,
    synopsis: result.synopsis ?? campaign.synopsis,
    world: result.world ?? campaign.world,
    chapters: result.chapters ?? campaign.chapters,
    character,
    transcript: [...kept, ...entries],
    stats: tallyChecks(campaign.stats, entries),
    updatedAt: now,
  }
}
