import type { Progress, Stars } from '@/app/meteor-coins/lib/progress'
import { STAGES } from '@/app/meteor-coins/lib/stages'

/**
 * Per-stage player scores: the shapes and the pure rules, shared by the API
 * routes, the Firestore store and the browser.
 *
 * Every player has one record per stage — their best, under their Firebase
 * uid (anonymous uids count, so a score made before sign-up carries over).
 * Each stage also has a board: its top entries, which lists only players
 * who have signed up and picked a nickname (CLAUDE.md "sign-up as reward";
 * the same rule as the trivia boards). Everyone else is still recorded and
 * told the place they'd take, which is the sell.
 */

export type ScoreResult = { stage: string; value: number; stars: Stars }

export type BoardEntry = {
  uid: string
  /** Nickname at the time of writing; '' when the player has none. */
  name: string
  /** Signed up with a nickname, so the board shows this entry. */
  named: boolean
  value: number
  stars: Stars
  /** When this best was made (ms since epoch); earlier wins a tie. */
  at: number
}

export type Board = {
  stage: string
  /** Everyone with a score on this stage, listed or not. */
  players: number
  /** Best first; holds the top MAX_ENTRIES across all players. */
  entries: BoardEntry[]
}

/** One player's standing on one stage. */
export type Placement = {
  best: number
  stars: Stars
  /** Place among the listed players, or null when off the bottom of the board. */
  rank: number | null
  players: number
  listed: boolean
}

/** What the server says about the caller, with a placement per stage played. */
export type MyScores = {
  signedUp: boolean
  nickname: string
  /** A board still shows this player under an old name or as unnamed. */
  nameStale: boolean
  stages: Record<string, Placement>
}

/** A stage's board as the browser sees it: listed players only. */
export type BoardView = {
  stage: string
  players: number
  entries: { uid: string; name: string; value: number; stars: Stars; rank: number }[]
  /** The caller's own standing, when they sent a token and have played. */
  me: Placement | null
}

export const MAX_ENTRIES = 200
/** Shown on a board page. */
export const SHOWN_ENTRIES = 20
export const MAX_VALUE = 9999

const PLAYABLE = new Set(STAGES.filter(s => s.playable).map(s => s.slug))

export function emptyBoard(stage: string): Board {
  return { stage, players: 0, entries: [] }
}

function isStars(n: unknown): n is Stars {
  return n === 0 || n === 1 || n === 2 || n === 3
}

/**
 * Reads results out of a request body. Anything malformed fails the whole
 * body (null), so a tampered request is dropped rather than half-applied.
 * One result per stage: duplicates keep the best.
 */
export function parseResults(raw: unknown): ScoreResult[] | null {
  if (!raw || typeof raw !== 'object') return null
  const { results } = raw as { results?: unknown }
  if (!Array.isArray(results) || results.length > PLAYABLE.size) return null
  const byStage = new Map<string, ScoreResult>()
  for (const item of results) {
    if (!item || typeof item !== 'object') return null
    const { stage, value, stars } = item as Record<string, unknown>
    if (typeof stage !== 'string' || !PLAYABLE.has(stage)) return null
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_VALUE)
      return null
    if (!isStars(stars)) return null
    const prior = byStage.get(stage)
    byStage.set(stage, {
      stage,
      value: Math.max(prior?.value ?? 0, value),
      stars: Math.max(prior?.stars ?? 0, stars) as Stars,
    })
  }
  return [...byStage.values()]
}

/** Replaces the player's entry, keeps the board sorted and capped. */
export function mergeEntry(board: Board, entry: BoardEntry): Board {
  const entries = [...board.entries.filter(e => e.uid !== entry.uid), entry]
    .sort((a, b) => b.value - a.value || a.at - b.at)
    .slice(0, MAX_ENTRIES)
  return { ...board, entries }
}

export function listedEntries(board: Board): BoardEntry[] {
  return board.entries.filter(e => e.named)
}

/**
 * The player's place among the listed players: their position if listed,
 * otherwise the place this score would take. Null when the board is full
 * and the score wouldn't make it on, so the place isn't known.
 */
export function rankOn(board: Board, uid: string, value: number): number | null {
  const listed = listedEntries(board)
  const index = listed.findIndex(e => e.uid === uid)
  if (index >= 0) return index + 1
  const last = board.entries.at(-1)
  if (board.entries.length >= MAX_ENTRIES && last && value <= last.value) return null
  // A tie goes to the player already there (they got it first).
  return 1 + listed.filter(e => e.value >= value).length
}

export function placementOn(board: Board, uid: string, best: number, stars: Stars): Placement {
  return {
    best,
    stars,
    rank: rankOn(board, uid, best),
    players: board.players,
    listed: listedEntries(board).some(e => e.uid === uid),
  }
}

export function boardView(board: Board, me: Placement | null): BoardView {
  return {
    stage: board.stage,
    players: board.players,
    entries: listedEntries(board)
      .slice(0, SHOWN_ENTRIES)
      .map((e, i) => ({ uid: e.uid, name: e.name, value: e.value, stars: e.stars, rank: i + 1 })),
    me,
  }
}

/**
 * Local bests the server doesn't have yet: scores made before scores were
 * kept, or on a day the save failed. Sent whole, the server keeps the max.
 */
export function unsentResults(progress: Progress, server: MyScores['stages']): ScoreResult[] {
  const out: ScoreResult[] = []
  for (const [stage, value] of Object.entries(progress.best)) {
    if (!PLAYABLE.has(stage)) continue
    const stars = progress.stars[stage] ?? 0
    const theirs = server[stage]
    if (!theirs || value > theirs.best || stars > theirs.stars) out.push({ stage, value, stars })
  }
  return out
}

/** How the result panel and the map word a placement. */
export function placeText(p: Placement): string {
  if (p.rank === null) return `${p.players} players have scored here.`
  if (p.listed) {
    if (p.players === 1) return 'First on the board.'
    return `#${p.rank} on the board · ${p.players} players`
  }
  return `You'd be #${p.rank} on the board.`
}

// ---------------------------------------------------------------------------
// Browser calls
// ---------------------------------------------------------------------------

const SCORES_URL = '/api/v1/meteor-coins/scores'

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchMyScores(token: string): Promise<MyScores | null> {
  try {
    const res = await fetch(SCORES_URL, { headers: authHeaders(token) })
    if (!res.ok) return null
    return (await res.json()) as MyScores
  } catch {
    return null
  }
}

export async function postResults(token: string, results: ScoreResult[]): Promise<MyScores | null> {
  try {
    const res = await fetch(SCORES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ results }),
    })
    if (!res.ok) return null
    return (await res.json()) as MyScores
  } catch {
    return null
  }
}

export async function fetchBoard(stage: string, token: string | null): Promise<BoardView | null> {
  try {
    const res = await fetch(`${SCORES_URL}/${stage}`, { headers: authHeaders(token) })
    if (!res.ok) return null
    return (await res.json()) as BoardView
  } catch {
    return null
  }
}
