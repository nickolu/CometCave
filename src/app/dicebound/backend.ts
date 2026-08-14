/**
 * Where a campaign is kept between visits.
 *
 * Two implementations behind one interface, chosen once in `DiceboundGame`:
 * the account-backed one when Firebase is configured (which is everyone,
 * since `useAuth` mints an anonymous uid on arrival), and a browser-local one
 * when it is not.
 *
 * Both are async even though the local one has nothing to await — a
 * synchronous API would have put `await` into every call site on the day this
 * moved to the network.
 *
 * Every failure is swallowed and degrades to "no campaign yet" or "this save
 * didn't land". A player mid-story whose network drops should lose the last
 * turn, not the evening; the next flush sends the whole campaign again anyway.
 */
import { type Campaign, trimToFit, validateCampaign } from './domain/campaign'

export interface CampaignBackend {
  /** Null when nothing has been stored yet. */
  load(): Promise<Campaign | null>
  save(campaign: Campaign): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'dicebound:campaign'

/**
 * This device only, no account, no network.
 *
 * Every access is wrapped because `localStorage` is not merely empty in
 * private-mode Safari and locked-down embeds — *reading it throws*.
 */
export const localBackend: CampaignBackend = {
  async load() {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? validateCampaign(JSON.parse(raw)) : null
    } catch {
      return null
    }
  },

  async save(campaign) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimToFit(campaign)))
    } catch {
      // Quota exceeded or storage disabled. The story stops persisting; play
      // carries on. Nothing here is worth interrupting a turn over.
    }
  },

  async clear() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // As above.
    }
  },
}

/** Remembers nothing. For server rendering and tests. */
export const nullBackend: CampaignBackend = {
  async load() {
    return null
  },
  async save() {},
  async clear() {},
}

const ENDPOINT = '/api/v1/dicebound/campaign'

/**
 * Kept against a Firebase account: one document per user, any device.
 *
 * Goes through an API route rather than the Firestore client SDK, which is the
 * house pattern — every collection in `firestore.rules` is closed to clients
 * and reached through a route holding the admin credentials. It also puts the
 * size and shape rules somewhere the player cannot edit.
 *
 * `getToken` is a function rather than a token because tokens expire and a
 * session outlasts them. It returning null is not an error — it means there is
 * no signed-in user yet, and the caller keeps whatever it had.
 */
export function accountBackend(getToken: () => Promise<string | null>): CampaignBackend {
  async function authed(init: RequestInit): Promise<Response | null> {
    const token = await getToken()
    if (!token) return null
    return fetch(ENDPOINT, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    })
  }

  return {
    async load() {
      try {
        const response = await authed({ method: 'GET' })
        if (!response?.ok) return null
        const body = (await response.json()) as { campaign?: unknown }
        return validateCampaign(body.campaign)
      } catch {
        return null
      }
    },

    async save(campaign) {
      try {
        await authed({
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ campaign: trimToFit(campaign) }),
        })
      } catch {
        // Offline, or the token expired mid-flight. The next flush carries the
        // whole campaign, so a dropped save costs nothing but a retry.
      }
    },

    async clear() {
      try {
        await authed({ method: 'DELETE' })
      } catch {
        // As above.
      }
    },
  }
}
