import type { TriviaGameResult } from '@/app/trivia/models/trivia'

const KEY_PREFIX = 'trivia:today:'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function keyFor(date: string): string {
  return `${KEY_PREFIX}${date}`
}

export function loadTodayResult(today: string): TriviaGameResult | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(keyFor(today))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TriviaGameResult
    if (parsed?.date !== today) return null
    return parsed
  } catch {
    return null
  }
}

export function saveTodayResult(result: TriviaGameResult): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(keyFor(result.date), JSON.stringify(result))
  } catch {
    // ignore quota/serialization errors — local state will fall through to Firestore on next login
  }
}

export function clearTodayResult(today: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(keyFor(today))
  } catch {
    // ignore
  }
}

export function cleanupOldDays(today: string): void {
  if (!isBrowser()) return
  try {
    const todayKey = keyFor(today)
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(KEY_PREFIX) && k !== todayKey) {
        toRemove.push(k)
      }
    }
    for (const k of toRemove) window.localStorage.removeItem(k)
  } catch {
    // ignore
  }
}
