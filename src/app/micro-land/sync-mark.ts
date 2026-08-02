/**
 * A note, per account, saying "everything this device kept locally is up there".
 *
 * The chronicle and the shelf each keep a copy on this device and a copy in the
 * player's account, and each folds the two together when auth resolves. That
 * fold is a union, and for everything the player *adds* a union is exactly
 * right: every record is a high-water mark, so there is no conflict to resolve
 * and nothing to ask about.
 *
 * It is exactly wrong for everything the player *removes*. A deletion is not a
 * record, it is the absence of one, and a union cannot tell "this device has a
 * creature the account has never seen" from "the account no longer has a
 * creature this device still remembers". Both look like one side holding
 * something the other does not, and the union puts it back.
 *
 * That was the whole of the "deleting does not work — it all comes back on
 * refresh" bug. Adopting an account moved the writes off the device and stopped
 * writing the local copy, freezing it at the moment of sign-in. Every deletion
 * afterwards reached the account and left that frozen copy alone, and the next
 * load merged it straight back in.
 *
 * This is the missing fact. When the mark names the account being adopted, the
 * account holds everything this device does *plus* whatever was deleted since,
 * so it is the whole truth and anything missing from it is missing on purpose.
 * When it does not — a first sign-in, a session that never managed to write, a
 * different account on the same device — the union is still correct and still
 * runs.
 *
 * A device with no usable storage simply never has a mark, which falls back to
 * the union. That is the older behaviour, not a broken one.
 */

/** The slice of `Storage` this needs. An interface so a test can hand one over. */
export interface SyncStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Kept together so it is obvious the two share a namespace. */
export const CHRONICLE_SYNC_KEY = 'micro-land:chronicle-synced'
export const WORLDS_SYNC_KEY = 'micro-land:worlds-synced'

/** `undefined` means "not looked for yet"; `null` means "there isn't one". */
let store: SyncStore | null | undefined

function resolve(): SyncStore | null {
  if (store !== undefined) return store
  try {
    // Merely *reading* `localStorage` throws in private-mode Safari and in
    // locked-down embeds, which is why this is wrapped rather than checked.
    store = typeof window === 'undefined' ? null : window.localStorage
  } catch {
    store = null
  }
  return store
}

export function readSyncMark(key: string): string | null {
  try {
    return resolve()?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Null clears the mark, which is how a caller says "no longer in step". */
export function writeSyncMark(key: string, accountId: string | null): void {
  try {
    const target = resolve()
    if (!target) return
    if (accountId === null) target.removeItem(key)
    else target.setItem(key, accountId)
  } catch {
    // Storage is full or refusing. Losing the mark costs a merge, which is the
    // behaviour this whole file replaced; it is never worth interrupting play.
  }
}

/** Test seam: put the marks somewhere a test can read and write them. */
export function setSyncStore(next: SyncStore | null): void {
  store = next
}
