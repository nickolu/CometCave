/**
 * The rules of Clusters, as pure functions. No Firestore, no network, no
 * clock. Everything the game decides is decided here so it can be tested
 * directly; `session.ts` is the only thing that should call these.
 */

import {
  type ClusterGroup,
  GROUP_SIZE,
  type GuessRecord,
  type GuessResult,
  type Tier,
} from '@/app/clusters/models/clusters'

export interface GuessOutcome {
  result: GuessResult
  /** Present only when `result === 'correct'`. */
  group?: ClusterGroup
  /** 1 for a wrong or one-away guess, 0 for a duplicate or a correct one. */
  mistakeDelta: number
}

/** Order-independent identity for a set of words. */
export function guessKey(words: string[]): string {
  return [...words]
    .map((w) => w.toUpperCase())
    .sort()
    .join(' ')
}

export type GuessRejection = 'wrong-size' | 'duplicate-words' | 'unknown-word' | 'already-solved'

/**
 * Structural validation, before the guess is scored. Checks the guess
 * against the actual board rather than just counting to four: a client that
 * sends the same word twice, or a word from a group already solved, must
 * not reach the scorer.
 */
export function validateGuess(
  layout: string[],
  guessWords: string[],
  solvedWords: string[]
): GuessRejection | null {
  if (guessWords.length !== GROUP_SIZE) return 'wrong-size'

  const upper = guessWords.map((w) => w.toUpperCase())
  if (new Set(upper).size !== upper.length) return 'duplicate-words'

  const board = new Set(layout.map((w) => w.toUpperCase()))
  if (upper.some((w) => !board.has(w))) return 'unknown-word'

  const solved = new Set(solvedWords.map((w) => w.toUpperCase()))
  if (upper.some((w) => solved.has(w))) return 'already-solved'

  return null
}

/**
 * Score a validated guess.
 *
 * `one-away` is a max-overlap test across ALL unsolved groups, not a
 * first-match scan: the guess is one away when its best overlap with any
 * single group is exactly three. One-away still costs a mistake. It is a
 * courtesy, not a free pass.
 */
export function evaluateGuess(
  groups: ClusterGroup[],
  guessWords: string[],
  solvedTiers: Tier[],
  history: GuessRecord[]
): GuessOutcome {
  const key = guessKey(guessWords)

  // A word-set already submitted is an accident, not a play. No penalty.
  if (history.some((h) => guessKey(h.words) === key)) {
    return { result: 'duplicate', mistakeDelta: 0 }
  }

  const guessed = new Set(guessWords.map((w) => w.toUpperCase()))
  const solved = new Set(solvedTiers)

  let best = 0
  for (const group of groups) {
    if (solved.has(group.tier)) continue
    const overlap = group.words.filter((w) => guessed.has(w.toUpperCase())).length
    if (overlap === GROUP_SIZE) {
      return { result: 'correct', group, mistakeDelta: 0 }
    }
    if (overlap > best) best = overlap
  }

  return {
    result: best === GROUP_SIZE - 1 ? 'one-away' : 'wrong',
    mistakeDelta: 1,
  }
}
