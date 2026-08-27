'use client'
/**
 * Badge Run backend — where completed run records are stored.
 *
 * Two implementations behind one interface:
 * - localBackend: persists to localStorage only (no account needed)
 * - accountBackend: persists to Firestore via API routes (requires auth)
 *
 * Follows the dicebound/backend.ts house pattern.
 * All failures are swallowed — a dropped save should never interrupt play.
 */
import {
  type RunRecord,
  validateRunRecord,
  runDateKey,
  runDocId,
} from './domain/run-record'

const LOCAL_RUN_KEY_PREFIX = 'badge-run:record:'

export interface BadgeRunBackend {
  /**
   * Load today's run for the current player.
   * Returns null if nothing is stored yet.
   */
  loadTodayRun(): Promise<RunRecord | null>
  /**
   * Save a completed run record.
   * Silently swallows errors — the game must remain playable if this fails.
   */
  saveRun(record: RunRecord): Promise<void>
}

// ---------------------------------------------------------------------------
// Local-only backend (no account)
// ---------------------------------------------------------------------------

function localKey(date: string, uid: string): string {
  return `${LOCAL_RUN_KEY_PREFIX}${runDocId(date, uid)}`
}

export const localBadgeRunBackend: BadgeRunBackend = {
  async loadTodayRun() {
    if (typeof window === 'undefined') return null
    try {
      const date = runDateKey(new Date())
      // For local storage we use 'anon' as uid
      const raw = window.localStorage.getItem(localKey(date, 'anon'))
      return raw ? validateRunRecord(JSON.parse(raw)) : null
    } catch {
      return null
    }
  },

  async saveRun(record) {
    if (typeof window === 'undefined') return
    try {
      const key = localKey(record.date, record.uid)
      window.localStorage.setItem(key, JSON.stringify(record))
    } catch {
      // localStorage full or disabled — silently drop
    }
  },
}

// ---------------------------------------------------------------------------
// Null backend (server rendering, tests)
// ---------------------------------------------------------------------------

export const nullBadgeRunBackend: BadgeRunBackend = {
  async loadTodayRun() { return null },
  async saveRun() {},
}

// ---------------------------------------------------------------------------
// Account backend (Firestore via API route)
// ---------------------------------------------------------------------------

const RUNS_ENDPOINT = '/api/v1/badge-run/runs'

/**
 * Backend backed by Firestore — one run per player per UTC day.
 * `getToken` is a function rather than a static token because tokens expire.
 * If it returns null the player has no account yet and we skip the save.
 */
export function accountBadgeRunBackend(
  getToken: () => Promise<string | null>,
): BadgeRunBackend {
  async function authed(init: RequestInit): Promise<Response | null> {
    const token = await getToken()
    if (!token) return null
    return fetch(RUNS_ENDPOINT, {
      ...init,
      headers: { ...((init.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
    })
  }

  return {
    async loadTodayRun() {
      try {
        const date = runDateKey(new Date())
        const response = await authed({ method: 'GET' })
        if (!response?.ok) return null
        const body = (await response.json()) as { record?: unknown }
        return validateRunRecord(body.record)
      } catch {
        return null
      }
    },

    async saveRun(record) {
      try {
        await authed({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ record }),
        })
      } catch {
        // Offline or token expired — silently drop; replay sends it next time
      }
    },
  }
}
