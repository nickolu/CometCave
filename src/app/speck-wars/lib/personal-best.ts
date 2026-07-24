import type { Difficulty } from '../store'

const KEY = (d: Difficulty) => `speck-wars-best-${d}`
const STREAK_KEY = 'speck-wars-win-streak'

export function getBestTime(difficulty: Difficulty): number | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(KEY(difficulty))
  const n = val ? Number(val) : NaN
  return isNaN(n) ? null : n
}

export function recordBestTime(difficulty: Difficulty, ms: number): boolean {
  if (typeof window === 'undefined') return false
  const prev = getBestTime(difficulty)
  if (prev === null || ms < prev) {
    localStorage.setItem(KEY(difficulty), String(ms))
    return true
  }
  return false
}

export function getWinStreak(): number {
  if (typeof window === 'undefined') return 0
  return Number(localStorage.getItem(STREAK_KEY) ?? '0') || 0
}

export function incrementWinStreak(): number {
  if (typeof window === 'undefined') return 0
  const next = getWinStreak() + 1
  localStorage.setItem(STREAK_KEY, String(next))
  return next
}

export function resetWinStreak() {
  if (typeof window === 'undefined') return
  localStorage.setItem(STREAK_KEY, '0')
}

interface GameResult { won: boolean; timeMs: number; kills: number }
const HISTORY_KEY = (d: Difficulty) => `speck-wars-history-${d}`
const HISTORY_LIMIT = 5

export function recordGameResult(difficulty: Difficulty, won: boolean, timeMs: number, kills: number) {
  if (typeof window === 'undefined') return
  const prev = getRecentResults(difficulty)
  const next: GameResult[] = [{ won, timeMs, kills }, ...prev].slice(0, HISTORY_LIMIT)
  localStorage.setItem(HISTORY_KEY(difficulty), JSON.stringify(next))
}

export function getRecentResults(difficulty: Difficulty): GameResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY(difficulty))
    return raw ? (JSON.parse(raw) as GameResult[]) : []
  } catch {
    return []
  }
}

const FIRST_GAME_KEY = 'speck-wars-first-game-done'

export function isFirstGame(): boolean {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(FIRST_GAME_KEY)
}

export function markFirstGameDone() {
  if (typeof window === 'undefined') return
  localStorage.setItem(FIRST_GAME_KEY, '1')
}
