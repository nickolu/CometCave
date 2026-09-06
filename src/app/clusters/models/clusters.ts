/**
 * Shared Clusters types. Imported by both the client components and the
 * server routes, so nothing in here may import firebase-admin.
 */

export const TIERS = ['yellow', 'green', 'blue', 'purple'] as const
export type Tier = (typeof TIERS)[number]

/** Human label for a tier. Tier is never conveyed by color alone (a11y). */
export const TIER_LABEL: Record<Tier, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
}

/** Difficulty wording used beside the tier name on a solved banner. */
export const TIER_DIFFICULTY: Record<Tier, string> = {
  yellow: 'easiest',
  green: 'easy',
  blue: 'hard',
  purple: 'hardest',
}

export const MAX_MISTAKES = 4
export const GROUP_SIZE = 4
export const BOARD_SIZE = 16

export interface ClusterGroup {
  tier: Tier
  title: string
  words: string[]
}

export interface SolvedGroup extends ClusterGroup {
  /** Index into the guess history of the guess that solved this group. */
  guessIndex: number
}

export type GuessResult = 'correct' | 'one-away' | 'wrong' | 'duplicate'

export interface GuessRecord {
  words: string[]
  result: GuessResult
  guessId: string
}

export type SessionStatus = 'in_progress' | 'won' | 'lost'

/** The part of a session the player is allowed to see. */
export interface ClustersSessionState {
  status: SessionStatus
  mistakes: number
  solved: SolvedGroup[]
  guesses: GuessRecord[]
}

export interface ClustersProfile {
  played: number
  /** Length 5. Index = mistakes made; index 4 means the run was lost. */
  mistakeDistribution: number[]
  purpleFirst: number
  currentStreak: number
  maxStreak: number
  lastPlayedDate: string | null
  /** Last same-day completion — the streak anchor. */
  lastStreakDate: string | null
}

export const EMPTY_PROFILE: ClustersProfile = {
  played: 0,
  mistakeDistribution: [0, 0, 0, 0, 0],
  purpleFirst: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
  lastStreakDate: null,
}

/** GET /api/v1/clusters/daily */
export interface DailyResponse {
  date: string
  puzzleNumber: number
  /** All 16 words in board order. Never grouped, never tiered. */
  words: string[]
  state: ClustersSessionState | null
  playable: boolean
  /** Present only once the run is over. */
  solution?: ClusterGroup[]
  editor?: string
  /** Original publication date, for the credit line. */
  sourceDate?: string
}

/** POST /api/v1/clusters/guess */
export interface GuessResponse {
  result: GuessResult
  /** Present only on `correct`. */
  group?: ClusterGroup
  mistakesLeft: number
  status: SessionStatus
  /** Present only on the guess that ends the run. */
  solution?: ClusterGroup[]
  profile?: ClustersProfile
}

/** GET /api/v1/clusters/archive */
export interface ArchiveDay {
  date: string
  puzzleNumber: number
  status: 'unplayed' | 'won' | 'lost' | 'in_progress'
  mistakes: number | null
}

export interface ArchiveResponse {
  today: string
  launchDate: string
  days: ArchiveDay[]
}

/* ── derived stats — never stored, always computed (see spec §5.1) ─────── */

export function statsFrom(profile: ClustersProfile) {
  const dist = profile.mistakeDistribution
  const losses = dist[MAX_MISTAKES] ?? 0
  const won = profile.played - losses
  return {
    played: profile.played,
    won,
    losses,
    perfect: dist[0] ?? 0,
    winRate: profile.played > 0 ? won / profile.played : 0,
    purpleFirst: profile.purpleFirst,
    maxStreak: profile.maxStreak,
  }
}
