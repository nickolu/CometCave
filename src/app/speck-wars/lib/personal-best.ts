import type { Difficulty } from '../store'

const KEY = (d: Difficulty) => `speck-wars-best-${d}`

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
