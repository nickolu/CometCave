/**
 * Folding a resolved turn back into a campaign.
 *
 * The server decides what happened; this decides what the save file looks like
 * afterwards. It is pure, and it is separate from both the route and the store
 * so the interesting arithmetic — streaks, skill ranks, the running tally of
 * natural 20s — can be tested without a network or a browser.
 */
import { endingFor } from './campaign'
import { type Character, recordSkillUse } from './character'

import type { Body } from './body'
import type { Campaign, CampaignStats, CheckEntry, TranscriptEntry } from './campaign'
import type { Kit } from './kit'
import type { World } from './world'

/** A tool call as the turn loop sees it: a name, and whatever the model sent. */
export interface ToolCall {
  name: string
  input: unknown
}

export const ROLL_CHECK_TOOL = 'roll_check'
export const NARRATE_TOOL = 'narrate'
export const RECALL_TOOL = 'recall'
export const GRANT_ITEM_TOOL = 'grant_item'
export const GRANT_POWER_TOOL = 'grant_power'
export const USE_POWER_TOOL = 'use_power'
export const HARM_TOOL = 'harm'
export const AFFLICT_TOOL = 'afflict'

/** One pass's tool calls, sorted into what the loop does with each. */
export interface TurnCalls<T extends ToolCall> {
  /** `roll_check` calls, to resolve against the die in the order they arrived. */
  rolls: T[]
  /**
   * `recall` lookups. Answered and the turn continues — a lookup is not a move,
   * so it neither ends the turn nor spends one of its checks.
   */
  recalls: T[]
  /** `grant_item` calls. Like a lookup: answered, and the turn carries on. */
  grants: T[]
  /**
   * `grant_power` calls. Same shape as an item grant, and separate from it
   * because the answer is different: an item grant reports what the thing is
   * worth, a power grant reports the tier it actually got — or the reason it
   * got nothing, which is a normal outcome rather than an error.
   */
  powerGrants: T[]
  /**
   * `use_power` calls. The charge is spent before anything is rolled, so like
   * every other bucket here the turn continues rather than ending — the DM has
   * to be told what the power made available before it can narrate around it.
   */
  powerUses: T[]
  /**
   * `harm` calls — damage with no check behind it.
   *
   * Answered and the turn continues, like a lookup and unlike a roll. A turn
   * where an ambush lands still owes the player the narration of it, and
   * ending on the tool result would leave them reading nothing at all.
   */
  harms: T[]
  /**
   * `afflict` calls — timed afflictions applied without a check.
   *
   * Answered and the turn continues, like harm. Narration written beside an
   * afflict is discarded: the DM sent the affliction and a narrative about its
   * effect in the same breath, before the server stamped the clock expiry and
   * applied the cap rule. Keeping both would narrate an outcome the DM could not
   * yet have known.
   */
  afflicts: T[]
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
  const grants = calls.filter(call => call.name === GRANT_ITEM_TOOL)
  const powerGrants = calls.filter(call => call.name === GRANT_POWER_TOOL)
  const powerUses = calls.filter(call => call.name === USE_POWER_TOOL)
  const harms = calls.filter(call => call.name === HARM_TOOL)
  const afflicts = calls.filter(call => call.name === AFFLICT_TOOL)
  const narrations = calls.filter(call => call.name === NARRATE_TOOL)

  // A narration sent alongside a lookup is as blind as one sent alongside a
  // roll: it was written before the answer came back, so whatever the DM asked
  // for cannot be in it. A power grant belongs in this list for a sharper
  // reason than the others — the grant can be *refused*, and narration written
  // beside it describes the character learning something they did not get.
  //
  // `harm` is in the list for the same reason as the die. The model names a
  // severity; the game decides what that severity costs, and it may cost
  // nothing at all. Narration composed in the same breath describes a wound
  // whose weight had not been assigned yet, and the model's guess at that
  // weight is the exact thing this tool exists to take away from it.
  if (
    rolls.length > 0 ||
    recalls.length > 0 ||
    grants.length > 0 ||
    powerGrants.length > 0 ||
    powerUses.length > 0 ||
    harms.length > 0 ||
    afflicts.length > 0
  ) {
    return {
      rolls,
      recalls,
      grants,
      powerGrants,
      powerUses,
      harms,
      afflicts,
      ending: null,
      premature: narrations,
    }
  }

  // Only the first narration ends the turn. A second one is a duplicate, not a
  // continuation, and appending both would read as the DM saying it twice.
  return {
    rolls,
    recalls,
    grants,
    powerGrants,
    powerUses,
    harms,
    afflicts,
    ending: narrations[0] ?? null,
    premature: narrations.slice(1),
  }
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
  /** The pack after anything the turn handed over. */
  kit?: Kit
  /**
   * The body after anything the turn did to it.
   *
   * Absent on the opening turn and on any path that never reached a roll, and
   * absent means *unchanged* rather than restored — the same rule `world` and
   * `kit` follow. A missing field that read as an undamaged body would make
   * every failed turn a free heal, which is a subtler bug than it sounds: the
   * player would never see it happen, they would only notice that nothing they
   * take ever seems to stay taken.
   */
  body?: Body
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
  entries: TranscriptEntry[],
  /**
   * Clock minutes of fiction at the end of the turn.
   *
   * Story time, not wall time. It is only used to stamp the moment a skill
   * matures, and a window measured in wall-clock minutes would close while the
   * player was making a cup of tea.
   */
  now = 0
): { character: Character; entries: TranscriptEntry[] } {
  let current = character
  const out: TranscriptEntry[] = []

  for (const entry of entries) {
    out.push(entry)
    if (entry.kind !== 'check' || !entry.skill) continue

    const { character: next, earned } = recordSkillUse(current, entry.skill, now)
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
  // The clock as the turn left it, falling back to where it started when the
  // turn never reached a narrate and so produced no world.
  const clock = (result.world ?? campaign.world).clock.elapsed
  const { character, entries } = creditSkills(campaign.character, result.entries, clock)
  const body = result.body ?? campaign.body

  const kept =
    result.dropped && result.dropped > 0
      ? campaign.transcript.slice(result.dropped)
      : campaign.transcript

  return {
    ...campaign,
    title: result.title ?? campaign.title,
    synopsis: result.synopsis ?? campaign.synopsis,
    world: result.world ?? campaign.world,
    kit: result.kit ?? campaign.kit,
    body,
    // The one place a run ends.
    //
    // Here rather than in the route, because both paths through a turn come
    // back through this function — the server-authoritative one and the
    // anonymous local one — and an ending stamped in only one of them is a
    // dead character who can keep playing as long as Firebase is switched off.
    //
    // `campaign.ending ??` is the whole of permanence. An ending is written
    // once and never revised, which also means this function does not need an
    // opinion about whether death can be undone later: that is a decision about
    // what may *clear* the field, and it stays a branch somewhere else.
    ending: campaign.ending ?? endingFor(body, clock, now),
    chapters: result.chapters ?? campaign.chapters,
    character,
    transcript: [...kept, ...entries],
    stats: tallyChecks(campaign.stats, entries),
    updatedAt: now,
  }
}
