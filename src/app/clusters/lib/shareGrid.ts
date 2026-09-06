import type { ClusterGroup, GuessRecord, SessionStatus } from '@/app/clusters/models/clusters'

import { TIER_EMOJI } from './tiers'

export interface ShareInput {
  puzzleNumber: number
  guesses: GuessRecord[]
  groups: ClusterGroup[]
  status: SessionStatus
}

/**
 * One row per guess, four squares in the order the player selected them.
 *
 * No words and no titles: a share must never spoil the puzzle for whoever
 * receives it. Duplicate guesses are left out because they were never
 * really plays.
 */
export function buildShareText({ puzzleNumber, guesses, groups, status }: ShareInput): string {
  const tierOf = new Map<string, string>()
  for (const group of groups) {
    for (const word of group.words) tierOf.set(word.toUpperCase(), TIER_EMOJI[group.tier])
  }

  const rows = guesses
    .filter((g) => g.result !== 'duplicate')
    .map((g) => g.words.map((w) => tierOf.get(w.toUpperCase()) ?? '⬛').join(''))

  const header = `Clusters #${puzzleNumber}${status === 'lost' ? ' — no dice' : ''}`
  return [header, ...rows].join('\n')
}

/** Copy to clipboard, falling back to a textarea where the API is blocked. */
export async function copyShareText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
