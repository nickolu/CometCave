import type { IncidentResult } from './rules'

export const STORAGE_KEY = 'postmortem:v1'
export const STORAGE_VERSION = 1
export const MAX_TOP_RUNS = 5

export type CardStats = {
  /** Times this card was a factor in an incident you played. */
  factor: number
  /** Times it was a factor and you picked it. */
  correct: number
  /** Times you picked it and it was not a factor. */
  wrong: number
  /** Times it was a factor and you did not pick it. */
  missed: number
}

export type SavedRun = {
  score: number
  /** ISO timestamp. */
  date: string
  solved: number
}

export type PostmortemData = {
  version: typeof STORAGE_VERSION
  cardStats: Record<string, CardStats>
  topRuns: SavedRun[]
}

export function emptyData(): PostmortemData {
  return { version: STORAGE_VERSION, cardStats: {}, topRuns: [] }
}

export function emptyStats(): CardStats {
  return { factor: 0, correct: 0, wrong: 0, missed: 0 }
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function sortRuns(runs: readonly SavedRun[]): SavedRun[] {
  // Higher score first; on a tie the earlier run keeps its place.
  return [...runs].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, MAX_TOP_RUNS)
}

/** Pure. Anything unreadable falls back to defaults; bad entries are dropped. */
export function parseData(raw: string | null | undefined): PostmortemData {
  if (!raw) return emptyData()
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return emptyData()
  }
  if (!isRecord(json) || json.version !== STORAGE_VERSION) return emptyData()

  const cardStats: Record<string, CardStats> = {}
  if (isRecord(json.cardStats)) {
    for (const [id, value] of Object.entries(json.cardStats)) {
      if (!isRecord(value)) continue
      const { factor, correct, wrong, missed } = value
      if (isCount(factor) && isCount(correct) && isCount(wrong) && isCount(missed)) {
        cardStats[id] = { factor, correct, wrong, missed }
      }
    }
  }

  const runs: SavedRun[] = []
  if (Array.isArray(json.topRuns)) {
    for (const value of json.topRuns) {
      if (!isRecord(value)) continue
      const { score, date, solved } = value
      if (typeof score === 'number' && Number.isFinite(score) && typeof date === 'string' && isCount(solved)) {
        runs.push({ score, date, solved })
      }
    }
  }

  return { version: STORAGE_VERSION, cardStats, topRuns: sortRuns(runs) }
}

/** Pure. */
export function serializeData(data: PostmortemData): string {
  return JSON.stringify(data)
}

/** Pure. Folds one finished incident into the lifetime per-card stats. */
export function addIncidentToStats(
  stats: Record<string, CardStats>,
  result: Pick<IncidentResult, 'factors' | 'correct' | 'wrong' | 'missed'>
): Record<string, CardStats> {
  const next = { ...stats }
  const bump = (id: string, field: keyof CardStats) => {
    const current = next[id] ?? emptyStats()
    next[id] = { ...current, [field]: current[field] + 1 }
  }
  for (const id of result.factors) bump(id, 'factor')
  for (const id of result.correct) bump(id, 'correct')
  for (const id of result.wrong) bump(id, 'wrong')
  for (const id of result.missed) bump(id, 'missed')
  return next
}

/** Pure. Records a finished run: card stats plus the top-5 list. */
export function recordRun(
  data: PostmortemData,
  results: readonly IncidentResult[],
  score: number,
  dateIso: string
): PostmortemData {
  let cardStats = data.cardStats
  for (const r of results) cardStats = addIncidentToStats(cardStats, r)
  const solved = results.filter(r => r.solved).length
  return {
    version: STORAGE_VERSION,
    cardStats,
    topRuns: sortRuns([...data.topRuns, { score, date: dateIso, solved }]),
  }
}

/** Best saved score, or null if no runs are saved. */
export function highScore(data: PostmortemData): number | null {
  return data.topRuns.length ? data.topRuns[0].score : null
}

/** Lifetime accuracy for one card as a 0-1 fraction, or null if it was never a factor. */
export function accuracy(stats: CardStats | undefined): number | null {
  if (!stats || stats.factor === 0) return null
  return stats.correct / stats.factor
}

export function readData(storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage()): PostmortemData {
  try {
    return parseData(storage?.getItem(STORAGE_KEY))
  } catch {
    return emptyData()
  }
}

/** Returns false if the write failed (private mode, quota, etc.). */
export function writeData(data: PostmortemData, storage: Pick<Storage, 'setItem'> | undefined = safeLocalStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(STORAGE_KEY, serializeData(data))
    return true
  } catch {
    return false
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
