/**
 * Where shelved worlds are actually kept.
 *
 * Same seam as `chronicle/backend.ts`, and for the same reason: nothing above
 * this file mentions `localStorage` or `fetch`. There are two implementations
 * and which one is in use is decided once, in `MicroLandGame`.
 *
 * The one real difference from the chronicle's backend is what a failed write
 * means. A dropped chronicle flush costs a few seconds of records and the next
 * flush carries them anyway, so it can be quiet. Saving a world is something the
 * player *asked for*, once, by name — if it doesn't happen they have to be told,
 * so `save` and `remove` throw and the shelf reports it.
 */
import {
  MAX_WORLD_BYTES,
  decodeWorldSave,
  summarize,
  validateWorldSave,
  worldSaveBytes,
} from './wire'

import type { WorldSave, WorldSummary } from './types'

export interface WorldsBackend {
  list(): Promise<WorldSummary[]>
  /** Null when there is no such world, or what's stored is unreadable. */
  load(id: string): Promise<WorldSave | null>
  save(save: WorldSave): Promise<void>
  remove(id: string): Promise<void>
}

const INDEX_KEY = 'micro-land:worlds'
const SAVE_PREFIX = 'micro-land:world:'

/**
 * Worlds on this device only: no account, no network.
 *
 * The index is kept as its own small key rather than derived by walking
 * `localStorage`, so listing the shelf never has to parse a megabyte of saves to
 * draw eight rows.
 *
 * Every access is wrapped, because `localStorage` is not merely empty in
 * private-mode Safari and locked-down embeds — *reading it throws*. Reads
 * degrade to an empty shelf. Writes are the exception: a quota error on a save
 * the player explicitly asked for is reported, not swallowed.
 */
export const localWorldsBackend: WorldsBackend = {
  async list() {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(INDEX_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as WorldSummary[]) : []
    } catch {
      return []
    }
  },

  async load(id) {
    if (typeof window === 'undefined') return null
    try {
      return decodeWorldSave(window.localStorage.getItem(SAVE_PREFIX + id))
    } catch {
      return null
    }
  },

  async save(save) {
    if (typeof window === 'undefined') return
    const index = await localWorldsBackend.list()
    const next = [summarize(save), ...index.filter(w => w.id !== save.id)]
    try {
      window.localStorage.setItem(SAVE_PREFIX + save.id, JSON.stringify(save))
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(next))
    } catch {
      // Almost always the 5 MB quota. Roll the index back so the shelf never
      // lists a world whose save isn't there — an entry that fails to open is a
      // worse outcome than a save that plainly didn't happen.
      try {
        window.localStorage.removeItem(SAVE_PREFIX + save.id)
        window.localStorage.setItem(INDEX_KEY, JSON.stringify(index))
      } catch {
        // Storage is refusing everything. Nothing left to tidy.
      }
      throw new Error('this browser has no room to keep another world')
    }
  },

  async remove(id) {
    if (typeof window === 'undefined') return
    const index = await localWorldsBackend.list()
    try {
      window.localStorage.removeItem(SAVE_PREFIX + id)
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(index.filter(w => w.id !== id)))
    } catch {
      throw new Error('this browser would not let go of that world')
    }
  },
}

/** A shelf that remembers nothing, for tests and for server rendering. */
export const nullWorldsBackend: WorldsBackend = {
  async list() {
    return []
  },
  async load() {
    return null
  },
  async save() {},
  async remove() {},
}

const ENDPOINT = '/api/v1/micro-land/worlds'

/**
 * Worlds kept against a Firebase account: one document per world, any device.
 *
 * Goes through an API route rather than the Firestore client SDK, which is the
 * house pattern — every collection in `firestore.rules` is closed to clients and
 * reached through a route holding the admin credentials.
 *
 * `getToken` is a function rather than a token because tokens expire and a
 * session outlasts them. `useAuth` mints an anonymous uid for everyone on
 * arrival, so this is the ordinary path for a player who has never signed up,
 * not a signed-in-only feature.
 */
export function accountWorldsBackend(getToken: () => Promise<string | null>): WorldsBackend {
  async function authorized(): Promise<HeadersInit | null> {
    const token = await getToken()
    return token ? { authorization: `Bearer ${token}` } : null
  }

  return {
    async list() {
      try {
        const headers = await authorized()
        if (!headers) return []
        const response = await fetch(ENDPOINT, { headers })
        if (!response.ok) return []
        const body = (await response.json()) as { worlds?: unknown }
        return Array.isArray(body.worlds) ? (body.worlds as WorldSummary[]) : []
      } catch {
        return []
      }
    },

    async load(id) {
      try {
        const headers = await authorized()
        if (!headers) return null
        const response = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, { headers })
        if (!response.ok) return null
        const body = (await response.json()) as { world?: unknown }
        // The route hands back the save as stored; re-validate here so a bad
        // document cannot reach the simulation through a trusted-looking channel.
        return validateWorldSave(body.world)
      } catch {
        return null
      }
    },

    async save(save) {
      const headers = await authorized()
      if (!headers) throw new Error('not signed in yet')

      // Checked before it leaves so an oversized world fails with something the
      // player can act on, rather than as a 413 from a route they can't see.
      if (worldSaveBytes(save) > MAX_WORLD_BYTES) {
        throw new Error('that world is too big to keep')
      }

      const response = await fetch(`${ENDPOINT}/${encodeURIComponent(save.id)}`, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ world: save }),
      })
      if (!response.ok) throw new Error(`world save failed: ${response.status}`)
    },

    async remove(id) {
      const headers = await authorized()
      if (!headers) throw new Error('not signed in yet')
      const response = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) throw new Error(`world delete failed: ${response.status}`)
    },
  }
}
