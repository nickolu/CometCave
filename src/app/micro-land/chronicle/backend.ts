/**
 * Where the chronicle is actually kept.
 *
 * This is the seam that makes the eventual move to accounts a swap rather than a
 * rewrite. Everything above this file talks to a `ChronicleBackend` and never
 * mentions `localStorage`; when records move to Firebase, a second
 * implementation lands here and `setBackend` gets called once at startup.
 *
 * Both methods are async even though the local one has nothing to await. That is
 * the deliberate part — a synchronous API today would put `await` into every
 * call site on the day it moves to the network.
 */
import { type ChronicleData, emptyChronicle } from './types'

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

/**
 * Sketch of the account-backed backend, for whoever wires it up.
 *
 * The shape below is the whole port — one document per user, read once on sign
 * in, written on the same debounce the local one uses. The interesting work is
 * not this file, it is deciding what happens to records a player set while
 * signed out (see the note on `mergeChronicles` in `chronicle.ts`).
 *
 *   export function firebaseBackend(uid: string): ChronicleBackend {
 *     const ref = doc(getFirestore(), 'microLandChronicles', uid)
 *     return {
 *       async load() {
 *         const snap = await getDoc(ref)
 *         return snap.exists() ? (snap.data() as ChronicleData) : null
 *       },
 *       async save(data) {
 *         await setDoc(ref, data)
 *       },
 *     }
 *   }
 */

/** Fallback used before `load` has resolved, so readers never see undefined. */
export const INITIAL_DATA = emptyChronicle()
