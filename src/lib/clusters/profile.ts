/**
 * Stat folding for Clusters, as pure functions.
 *
 * Only `mistakeDistribution`, `purpleFirst` and the streaks are stored.
 * Wins, losses and perfects are derived from the distribution (see
 * `statsFrom`) because separate counters drift against the histogram, and
 * drifted stats are worse than absent ones.
 */

import {
  type ClustersProfile,
  EMPTY_PROFILE,
  MAX_MISTAKES,
} from '@/app/clusters/models/clusters'

import { addDays } from './dateMap'

export interface RunOutcome {
  /** The play date of the puzzle, not the date it was finished. */
  date: string
  mistakes: number
  won: boolean
  /** Purple was the first group solved. */
  purpleFirst: boolean
  /**
   * Frozen when the session was created, from `date === todayPacific`.
   * Archive plays never move the streak.
   */
  countsForStreak: boolean
}

export function normalizeProfile(raw: Partial<ClustersProfile> | undefined): ClustersProfile {
  if (!raw) return { ...EMPTY_PROFILE, mistakeDistribution: [...EMPTY_PROFILE.mistakeDistribution] }
  const dist = Array.isArray(raw.mistakeDistribution) ? raw.mistakeDistribution : []
  return {
    played: typeof raw.played === 'number' ? raw.played : 0,
    mistakeDistribution: Array.from(
      { length: MAX_MISTAKES + 1 },
      (_, i) => (typeof dist[i] === 'number' ? dist[i] : 0)
    ),
    purpleFirst: typeof raw.purpleFirst === 'number' ? raw.purpleFirst : 0,
    currentStreak: typeof raw.currentStreak === 'number' ? raw.currentStreak : 0,
    maxStreak: typeof raw.maxStreak === 'number' ? raw.maxStreak : 0,
    lastPlayedDate: typeof raw.lastPlayedDate === 'string' ? raw.lastPlayedDate : null,
    lastStreakDate: typeof raw.lastStreakDate === 'string' ? raw.lastStreakDate : null,
  }
}

/**
 * Fold one finished run into a profile. Idempotency is the caller's job:
 * the guess transaction only reaches this once, guarded on the session
 * still being `in_progress`.
 */
export function applyResult(profile: ClustersProfile, outcome: RunOutcome): ClustersProfile {
  const next = normalizeProfile(profile)

  const bucket = Math.min(Math.max(outcome.mistakes, 0), MAX_MISTAKES)
  const dist = [...next.mistakeDistribution]
  dist[bucket] += 1

  let { currentStreak, maxStreak } = next
  let lastStreakDate = next.lastStreakDate

  if (outcome.countsForStreak) {
    // A same-day completion the day after the last one extends the run;
    // anything else starts a fresh one. Losing does not break it (spec 5.2).
    currentStreak =
      lastStreakDate && lastStreakDate === addDays(outcome.date, -1) ? currentStreak + 1 : 1
    maxStreak = Math.max(maxStreak, currentStreak)
    lastStreakDate = outcome.date
  }

  const lastPlayedDate =
    !next.lastPlayedDate || outcome.date > next.lastPlayedDate ? outcome.date : next.lastPlayedDate

  return {
    played: next.played + 1,
    mistakeDistribution: dist,
    purpleFirst: next.purpleFirst + (outcome.purpleFirst ? 1 : 0),
    currentStreak,
    maxStreak,
    lastPlayedDate,
    lastStreakDate,
  }
}

/**
 * The streak to SHOW. The stored one is stale by design: missing a day
 * writes nothing, so `currentStreak` still reads 7 the morning after it
 * broke. Every surface that renders a streak must go through here, or the
 * number will disagree with itself across pages.
 */
export function displayedStreak(profile: ClustersProfile, today: string): number {
  const anchor = profile.lastStreakDate
  if (!anchor) return 0
  if (anchor === today || anchor === addDays(today, -1)) return profile.currentStreak
  return 0
}
