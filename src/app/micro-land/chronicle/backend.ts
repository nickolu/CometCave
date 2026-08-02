/**
 * Where the chronicle is actually kept.
 *
 * This is the seam that makes the move to accounts a swap rather than a rewrite.
 * Everything above this file talks to a `ChronicleBackend` and never mentions
 * `localStorage` or `fetch`; there are now two implementations, and which one is
 * in use is decided once, in `MicroLandGame`.
 *
 * Both methods are async even though the local one has nothing to await. That is
 * the deliberate part — a synchronous API would have put `await` into every call
 * site on the day this moved to the network.
 */
import { type ChronicleData, emptyChronicle } from './types'
import { fitChronicle, validateChronicle } from './wire'

export interface ChronicleBackend {
  /** Returns null when nothing has been stored yet. */
  load(): Promise<ChronicleData | null>
  save(data: ChronicleData): Promise<void>
}

const STORAGE_KEY = 'micro-land:chronicle'

/**
 * Browser-local records: no account, no network, this device only.
 *
 * Every access is wrapped, because `localStorage` is not merely empty in
 * private-mode Safari and locked-down embeds — *reading it throws*. A player
 * whose browser refuses storage should still get a working game that simply
 * doesn't remember anything, so failure here is always silent and always
 * degrades to "no records yet".
 */
export const localBackend: ChronicleBackend = {
  async load() {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as ChronicleData
    } catch {
      return null
    }
  },

  async save(data) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Quota exceeded or storage disabled. Records stop persisting; the game
      // carries on. Nothing here is worth interrupting play over.
    }
  },
}

/** A backend that remembers nothing, for tests and for server rendering. */
export const nullBackend: ChronicleBackend = {
  async load() {
    return null
  },
  async save() {},
}

const ENDPOINT = '/api/v1/micro-land/chronicle'

/**
 * Records kept against a Firebase account: one document per user, any device.
 *
 * Goes through an API route rather than the Firestore client SDK, which is the
 * house pattern — every collection in `firestore.rules` is closed to clients and
 * reached through a route holding the admin credentials. It also means the size
 * and shape rules live somewhere the player cannot edit.
 *
 * `getToken` is a function rather than a token because tokens expire and a
 * session outlasts them. It returns null when there is no signed-in user, which
 * is not an error — the caller simply keeps whatever backend it had.
 *
 * Every failure here is swallowed. A player mid-game whose network drops should
 * lose the last few seconds of records, not the game; the next flush will carry
 * everything anyway, because the chronicle writes its whole state each time
 * rather than a diff.
 */
export function accountBackend(getToken: () => Promise<string | null>): ChronicleBackend {
  async function authorized(): Promise<HeadersInit | null> {
    const token = await getToken()
    return token ? { authorization: `Bearer ${token}` } : null
  }

  return {
    async load() {
      try {
        const headers = await authorized()
        if (!headers) return null
        const response = await fetch(ENDPOINT, { headers })
        if (!response.ok) return null
        const body = (await response.json()) as { chronicle?: unknown }
        // The route hands back the chronicle as stored; re-validate it here so a
        // bad document can't reach the game through a trusted-looking channel.
        // Null is the ordinary answer for a player who has never saved.
        return validateChronicle(body.chronicle)
      } catch {
        return null
      }
    },

    /**
     * Throws on failure, deliberately.
     *
     * An earlier version swallowed everything here so a network blip could never
     * interrupt play. It still cannot — `flushChronicle` catches — but catching
     * it *there* is what lets the game know a write failed, retry it, and tell
     * the player. Swallowed at this level it was invisible to everything,
     * including the code that had already marked the records as saved.
     */
    async save(data) {
      const headers = await authorized()
      // No signed-in user yet. Not a failure: the local backend still has it.
      if (!headers) return

      // Trimmed before it leaves, so an oversized archive degrades to a
      // shorter one instead of a rejected write that records nothing.
      const body = JSON.stringify({ chronicle: fitChronicle(data) })
      const response = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body,
        /**
         * The last flush of a session fires from `pagehide`, where an ordinary
         * fetch is cancelled as the page goes away and the records are lost.
         *
         * `keepalive` survives that, but the spec caps a keepalive body at
         * 64 KiB and rejects anything larger outright — which would single out
         * the biggest archives, the ones with the most to lose. So it is only
         * asked for when the body is comfortably under that. Above it we rely
         * on the `visibilitychange` flush, which runs while the page is still
         * alive and is the one that actually fires on mobile.
         */
        keepalive: body.length < 60_000,
      })

      if (!response.ok) {
        throw new Error(`chronicle save failed: ${response.status}`)
      }
    },
  }
}

/** Fallback used before `load` has resolved, so readers never see undefined. */
export const INITIAL_DATA = emptyChronicle()
