import {
  type ClusterGroup,
  type GuessRecord,
  MAX_MISTAKES,
  type SessionStatus,
} from '@/app/clusters/models/clusters'

import { TIER_EMOJI } from './tiers'

/**
 * Today's puzzle, not the dated archive URL.
 *
 * A share link has to drop the reader straight into play, and a day can only
 * ever be played once — so sending someone to a specific archive date would
 * silently burn that day for them, and an archive play builds no streak. In
 * the case that actually happens (sharing minutes after playing), today's
 * puzzle IS the one being shared about.
 */
export const CLUSTERS_SHARE_URL = 'https://cometcave.com/clusters'

export interface ShareInput {
  puzzleNumber: number
  guesses: GuessRecord[]
  /** All four groups, for the word-to-tier lookup. */
  groups: ClusterGroup[]
  /** The groups the player ended up with, in the order they were solved. */
  solved: ClusterGroup[]
  status: SessionStatus
  mistakes: number
}

export interface ShareResult {
  /** "Clusters #86 · 2 mistakes" */
  title: string
  /** One row of four tier squares per guess. */
  rows: string[]
  url: string
  /** Title, grid and link — exactly what lands on the clipboard. */
  text: string
}

/** Order-independent identity for a set of words. */
function wordSetKey(words: string[]): string {
  return [...words]
    .map((w) => w.toUpperCase())
    .sort()
    .join(' ')
}

function titleFor(puzzleNumber: number, status: SessionStatus, mistakes: number): string {
  const suffix =
    status === 'lost'
      ? 'unsolved'
      : mistakes === 0
        ? 'perfect'
        : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`
  return `Clusters #${puzzleNumber} · ${suffix}`
}

/**
 * One row per guess, four squares in the order the player selected them.
 *
 * No words and no titles: a share must never spoil the puzzle for whoever
 * receives it. Duplicate guesses are left out because they were never
 * really plays.
 */
export function buildShare({
  puzzleNumber,
  guesses,
  groups,
  solved,
  status,
  mistakes,
}: ShareInput): ShareResult {
  const tierOf = new Map<string, string>()
  for (const group of groups) {
    for (const word of group.words) tierOf.set(word.toUpperCase(), TIER_EMOJI[group.tier])
  }

  const rows = guesses
    .filter((g) => g.result !== 'duplicate')
    .map((g) => g.words.map((w) => tierOf.get(w.toUpperCase()) ?? '⬛').join(''))

  // Solving three groups leaves the fourth forced, and the server resolves
  // it rather than making the player click a foregone conclusion — so that
  // group has no guess of its own. Without this a clean win shares as three
  // rows and the winning group is missing from the grid entirely.
  //
  // Only on a win: auto-resolve can only fire on the guess that finishes the
  // board, and on a loss `solved` also carries the groups the reveal added,
  // which the player never earned a row for.
  if (status === 'won') {
    const guessed = new Set(
      guesses.filter((g) => g.result === 'correct').map((g) => wordSetKey(g.words))
    )
    for (const group of solved) {
      if (!guessed.has(wordSetKey(group.words))) {
        rows.push(TIER_EMOJI[group.tier].repeat(group.words.length))
      }
    }
  }

  const title = titleFor(puzzleNumber, status, Math.min(mistakes, MAX_MISTAKES))
  return {
    title,
    rows,
    url: CLUSTERS_SHARE_URL,
    text: [title, ...rows, '', CLUSTERS_SHARE_URL].join('\n'),
  }
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
