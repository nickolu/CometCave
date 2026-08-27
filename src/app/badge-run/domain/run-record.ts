/**
 * B-7.1 — Badge Run persistence schema.
 *
 * Serializable snapshot of a completed run.
 * Lives in domain/ as a pure type — no Firestore, no runtime imports.
 *
 * Firestore layout:
 *   badge-run-runs/{date}_{uid}        one record per player per UTC day
 *   badge-run-leaderboard/{date}       top entries for the day (scalar fields)
 *
 * Each document is a single JSON blob plus indexable scalars (uid, date,
 * badgesEarned, outcome) so the ghost and leaderboard queries work without
 * indexing the full draft sequence.
 */

// ---------------------------------------------------------------------------
// Core run record
// ---------------------------------------------------------------------------

export interface DraftPick {
  round: number
  pick: number         // dexId chosen
  offers: number[]     // dexIds offered (always 3)
}

/**
 * Complete record of a finished run — both outcome and decision log.
 * Written when the player reaches the summary screen.
 */
export interface RunRecord {
  /** Firestore document ID: `{date}_{uid}` (e.g. "20260827_abc123") */
  id: string

  /** Player's Firebase uid (or 'anon' for not-yet-signed-in). */
  uid: string

  /** UTC date of the run: YYYY-MM-DD. Matches the daily seed. */
  date: string

  /** The seed used for this run. */
  seed: number

  /** How the run ended. */
  outcome: 'won' | 'lost' | 'eliminated'

  /**
   * Rounds cleared (= badges earned in Blitz, or gym badges in gauntlet).
   * Primary leaderboard sort key.
   */
  badgesEarned: number

  /** The round where the run terminated (1-indexed). */
  finalRound: number

  /** dexIds of units on the final team. */
  teamDexIds: number[]

  /** Survival levels at end of run. Keys are dexId strings. */
  boardLevels: Record<string, number>

  /** Ordered draft choices — the ghost replay log. */
  draftSequence: DraftPick[]

  /** Unix epoch ms when the run was written. */
  timestamp: number
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * One player's entry in the daily leaderboard.
 * Stored as an array inside `badge-run-leaderboard/{date}`.
 */
export interface LeaderboardEntry {
  uid: string
  displayName: string   // Firebase display name, or 'Trainer' for anonymous
  badgesEarned: number
  finalRound: number
  outcome: RunRecord['outcome']
  timestamp: number
}

/** Leaderboard document stored at `badge-run-leaderboard/{date}`. */
export interface LeaderboardDocument {
  date: string
  entries: LeaderboardEntry[]  // top 100, sorted by badgesEarned desc
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_OUTCOMES = new Set(['won', 'lost', 'eliminated'])

export function validateRunRecord(raw: unknown): RunRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.uid !== 'string' ||
    typeof r.date !== 'string' ||
    typeof r.seed !== 'number' ||
    typeof r.outcome !== 'string' || !VALID_OUTCOMES.has(r.outcome) ||
    typeof r.badgesEarned !== 'number' ||
    typeof r.finalRound !== 'number' ||
    !Array.isArray(r.teamDexIds) ||
    !Array.isArray(r.draftSequence) ||
    typeof r.timestamp !== 'number'
  ) {
    return null
  }
  return {
    id: typeof r.id === 'string' ? r.id : runDocId(String(r.date), String(r.uid)),
    uid: r.uid,
    date: r.date,
    seed: r.seed,
    outcome: r.outcome as RunRecord['outcome'],
    badgesEarned: r.badgesEarned,
    finalRound: r.finalRound,
    teamDexIds: (r.teamDexIds as unknown[]).filter((x): x is number => typeof x === 'number'),
    boardLevels: (r.boardLevels && typeof r.boardLevels === 'object')
      ? r.boardLevels as Record<string, number>
      : {},
    draftSequence: (r.draftSequence as unknown[]).filter((x): x is DraftPick =>
      !!x && typeof x === 'object' &&
      typeof (x as DraftPick).round === 'number' &&
      typeof (x as DraftPick).pick === 'number' &&
      Array.isArray((x as DraftPick).offers)
    ),
    timestamp: r.timestamp,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Today's UTC date string (YYYY-MM-DD). Pure — takes a Date for testability. */
export function runDateKey(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Firestore document ID for a run: `{YYYYMMDD}_{uid}`. */
export function runDocId(date: string, uid: string): string {
  return `${date.replace(/-/g, '')}_${uid}`
}
