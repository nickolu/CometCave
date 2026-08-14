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

/** What a turn produced, before it has been written down anywhere. */
export interface TurnResult {
  entries: TranscriptEntry[]
  /** Set on the opening turn only. */
  title?: string
  /** Set when the turn also condensed old history. */
  synopsis?: string
  /** How many leading transcript entries the synopsis replaced. */
  dropped?: number
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
    character,
    transcript: [...kept, ...entries],
    stats: tallyChecks(campaign.stats, entries),
    updatedAt: now,
  }
}
