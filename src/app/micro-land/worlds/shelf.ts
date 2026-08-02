/**
 * The shelf — one place that knows which worlds exist and which one is open.
 *
 * Module state rather than store state, exactly as the chronicle is, and for the
 * same reason: this outlives any React tree, has to work before one has mounted,
 * and is read by the game instance imperatively. The store gets a snapshot
 * pushed at it through `onShelf` so panels can render it like anything else.
 *
 * The one rule worth holding on to: **a shelved world is the one you are
 * playing, until you change the land.** Painting, placing, summoning creatures
 * and clearing life all happen *inside* a world and keep updating it. Choosing a
 * different theme, reshaping, or summoning new terrain makes a new unsaved world
 * and lets go of the shelved one. Without that, "Reshape" would quietly destroy
 * the world the player had asked the game to keep.
 */
import { WORLDS_SYNC_KEY, readSyncMark, writeSyncMark } from '@/app/micro-land/sync-mark'

import { type WorldsBackend, localWorldsBackend } from './backend'
import { MAX_SAVED_WORLDS, summarize } from './wire'

import type { WorldSave, WorldSummary } from './types'

/** How long after a change the open world is written back. */
const AUTOSAVE_MS = 20_000

export interface ShelfState {
  worlds: WorldSummary[]
  /** The shelved world currently being played, if any. */
  activeId: string | null
  /** A list, open, save or delete is in flight. */
  busy: boolean
  /** Something the player should be told about the last operation. */
  error: string | null
}

let backend: WorldsBackend = localWorldsBackend
/**
 * The device shelf, once the account has taken over the writes.
 *
 * Same reasoning as the chronicle's mirror: a local copy that stops being
 * written freezes at the moment of sign-in, and every load afterwards argues for
 * re-uploading the worlds the player has since thrown away. Saves and deletions
 * both go through to it, so it never drifts from the account on this device.
 */
let mirror: WorldsBackend | null = null
let state: ShelfState = { worlds: [], activeId: null, busy: false, error: null }
let listeners = new Set<(state: ShelfState) => void>()
let listed = false
let listing: Promise<void> | null = null

/** Set by the game so the shelf can write the open world back on its own. */
let takeSnapshot: (() => WorldSave | null) | null = null
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false
let hideHooked = false

export function onShelf(fn: (state: ShelfState) => void): () => void {
  listeners.add(fn)
  fn(state)
  return () => {
    listeners.delete(fn)
  }
}

export function readShelf(): ShelfState {
  return state
}

function publish(patch: Partial<ShelfState>): void {
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state)
}

/** Newest first — the shelf reads as "what I was just playing", not an archive. */
function order(worlds: WorldSummary[]): WorldSummary[] {
  return [...worlds].sort((a, b) => b.updatedAt - a.updatedAt)
}

function withSummary(worlds: WorldSummary[], summary: WorldSummary): WorldSummary[] {
  return order([summary, ...worlds.filter(w => w.id !== summary.id)])
}

/**
 * Read the shelf once.
 *
 * Memoized on the in-flight promise rather than on `listed`, which is only set
 * after the await: two panels mounting in the same frame would otherwise both
 * see "not listed yet" and both hit the network.
 */
export async function initShelf(): Promise<void> {
  if (listed) return
  if (listing) return listing

  listing = (async () => {
    publish({ busy: true })
    let worlds: WorldSummary[] = []
    try {
      worlds = await backend.list()
    } catch {
      // A shelf that cannot be read shows as empty rather than as an error. This
      // runs on mount against this device's own storage, where the only way to
      // fail is a browser refusing storage outright.
    }
    listed = true
    publish({ worlds: order(worlds), busy: false })
  })()

  try {
    await listing
  } finally {
    listing = null
  }
}

/**
 * Move this device's shelf onto the player's account.
 *
 * Union by id, newest `updatedAt` wins, and anything local that the account has
 * not seen is uploaded. No conflict resolution beyond that and none is needed:
 * ids are minted randomly per save (see `newSaveId`), so the same id on two
 * devices means the same world, and the later write is the one the player made
 * later.
 *
 * Failures here are swallowed on purpose. This runs unprompted when auth
 * resolves; a player who is offline keeps the local shelf they already had, and
 * the next save will try again.
 *
 * The upload only happens while this device still holds something the account
 * has never seen. Once the mark says otherwise (`sync-mark.ts`), the account's
 * list is the whole truth: a world it does not name was *deleted*, not
 * undiscovered, and uploading it again is precisely how a forgotten world came
 * back on the next refresh. Then the local copies go instead.
 */
export async function adoptWorldsAccount(next: WorldsBackend, account: string): Promise<void> {
  if (backend === next) return
  await initShelf()

  const local = state.worlds
  // Whatever was being written before the account took over becomes the mirror —
  // `localWorldsBackend` in the game, and whatever a test installed in a test.
  // Adopting a *second* account (a sign-out and back in under another uid) keeps
  // the one already found: the device is still the thing to mirror.
  const device = mirror ?? backend

  let remote: WorldSummary[]
  try {
    remote = await next.list()
  } catch {
    // The account could not be read. Take it over for writes — a save the player
    // asks for should go to the account and can report its own failure — but
    // reconcile nothing: every world would look deleted.
    backend = next
    mirror = device
    return
  }

  const mirrored = readSyncMark(WORLDS_SYNC_KEY) === account
  const remoteById = new Map(remote.map(w => [w.id, w]))

  backend = next
  mirror = device
  publish({ busy: true })

  // Cleared by any world that would not go up, so the mark never claims more
  // than actually happened — a lie here deletes that world on the next visit.
  let allPushed = true

  for (const summary of local) {
    if (mirrored) {
      // Deleted elsewhere, or deleted here in a session whose local removal did
      // not land. Either way the account has already settled it.
      if (remoteById.has(summary.id)) continue
      try {
        await device.remove(summary.id)
      } catch {
        // Storage is refusing. The entry is not published either way, so the
        // player does not see the world; the blob is tidied on a later visit.
      }
      continue
    }

    const known = remoteById.get(summary.id)
    if (known && known.updatedAt >= summary.updatedAt) continue
    try {
      const save = await device.load(summary.id)
      if (save) await next.save(save)
      remoteById.set(summary.id, summary)
    } catch {
      // Offline, or the account shelf is full. Keep going: one world that
      // refuses to upload must not cost the player the rest of them.
      allPushed = false
    }
  }

  writeSyncMark(WORLDS_SYNC_KEY, allPushed ? account : null)
  publish({ worlds: order([...remoteById.values()]).slice(0, MAX_SAVED_WORLDS), busy: false })
}

export function setBackend(next: WorldsBackend): void {
  backend = next
  mirror = null
  listed = false
  listing = null
  publish({ worlds: [], activeId: null, busy: false, error: null })
}

/**
 * Keep the device copy in step behind the account's.
 *
 * Best-effort and quiet, both ways round: this is a cache, not the record. A
 * local quota error on a world that is safely in the account is not worth
 * interrupting the player with, and a local removal that fails is cleaned up by
 * the reconcile on the next visit.
 */
async function mirrorSave(save: WorldSave): Promise<void> {
  if (!mirror) return
  try {
    await mirror.save(save)
  } catch {
    // See above — the account has it, which is what the player was promised.
  }
}

async function mirrorRemove(id: string): Promise<void> {
  if (!mirror) return
  try {
    await mirror.remove(id)
  } catch {
    // See above — it is gone from the account, which is what the player asked.
  }
}

export function isShelfFull(): boolean {
  return state.worlds.length >= MAX_SAVED_WORLDS
}

/**
 * Register how to freeze the world that's on screen.
 *
 * The shelf writes the open world back on its own — on a slow debounce and when
 * the page goes away — and it cannot reach into the game instance to do it, so
 * the game hands it a way. Called with null on teardown.
 */
export function provideSnapshot(fn: (() => WorldSave | null) | null): void {
  takeSnapshot = fn
}

/** Put a world on the shelf, or write the open one back. Throws on failure. */
export async function keepWorld(save: WorldSave): Promise<void> {
  publish({ busy: true, error: null })
  try {
    await backend.save(save)
    await mirrorSave(save)
    publish({
      worlds: withSummary(state.worlds, summarize(save)),
      activeId: save.id,
      busy: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'that world would not keep'
    publish({ busy: false, error: message })
    throw error
  }
}

export async function readWorld(id: string): Promise<WorldSave | null> {
  publish({ busy: true, error: null })
  try {
    const save = await backend.load(id)
    publish({ busy: false, error: save ? null : 'that world could not be opened' })
    return save
  } catch {
    publish({ busy: false, error: 'that world could not be opened' })
    return null
  }
}

export async function removeWorld(id: string): Promise<void> {
  publish({ busy: true, error: null })
  try {
    await backend.remove(id)
    // Through to this device as well, or the copy left behind is uploaded again
    // the next time the account is adopted and the world reappears on the shelf.
    await mirrorRemove(id)
    // Deleting the world you are standing in leaves you standing in it — it is
    // simply no longer kept. The pending autosave has to go with it, or it would
    // write the world straight back a few seconds later.
    if (state.activeId === id) releaseActiveWorld()
    publish({ worlds: state.worlds.filter(w => w.id !== id), busy: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'that world would not let go'
    publish({ busy: false, error: message })
  }
}

/** Which shelved world is on screen, if any. */
export function activeWorldId(): string | null {
  return state.activeId
}

/**
 * Let go of the shelved world without deleting it.
 *
 * Called when the land is replaced — a new theme, a reshape, summoned terrain.
 * The player is now somewhere else, and the next autosave must not overwrite the
 * world they asked the game to keep with the one that replaced it.
 */
export function releaseActiveWorld(): void {
  dirty = false
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  if (state.activeId !== null) publish({ activeId: null })
}

export function setActiveWorld(id: string | null): void {
  publish({ activeId: id })
}

/**
 * Note that the open world has moved on, and arrange to write it back.
 *
 * Debounced hard — twenty seconds — because this is a simulation and *every*
 * tick changes it. A save is a few hundred kilobytes; writing one per second
 * would be a fine way to spend a player's data plan on a terrarium.
 */
export function touchActiveWorld(): void {
  if (state.activeId === null) return
  dirty = true
  attachFlushOnHide()
  if (autosaveTimer !== null) return
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    void flushActiveWorld()
  }, AUTOSAVE_MS)
}

/**
 * Write the open world back now.
 *
 * Quiet on failure, unlike `keepWorld`: this one fires on a timer and on the way
 * out of the page, where there is nobody to tell and nothing useful to say. The
 * world stays dirty so the next attempt carries it.
 */
export async function flushActiveWorld(): Promise<void> {
  if (!dirty || state.activeId === null || !takeSnapshot) return
  const save = takeSnapshot()
  if (!save || save.id !== state.activeId) return

  dirty = false
  try {
    await backend.save(save)
    await mirrorSave(save)
    publish({ worlds: withSummary(state.worlds, summarize(save)) })
  } catch {
    dirty = true
  }
}

/**
 * Flush when the page goes away.
 *
 * `visibilitychange` rather than `beforeunload`, which mobile browsers do not
 * reliably fire — a phone backgrounding the tab is the ordinary way a session
 * ends, and it is exactly the case where "pick up where you left off" is being
 * promised. `pagehide` covers the desktop close.
 */
function attachFlushOnHide(): void {
  if (hideHooked || typeof document === 'undefined') return
  hideHooked = true
  const flush = () => {
    if (document.visibilityState === 'hidden') void flushActiveWorld()
  }
  document.addEventListener('visibilitychange', flush)
  window.addEventListener('pagehide', () => void flushActiveWorld())
}

/** Test seam: put the module back to how it loaded. */
export function resetShelf(): void {
  backend = localWorldsBackend
  mirror = null
  state = { worlds: [], activeId: null, busy: false, error: null }
  listeners = new Set()
  listed = false
  listing = null
  takeSnapshot = null
  dirty = false
  if (autosaveTimer !== null) clearTimeout(autosaveTimer)
  autosaveTimer = null
}
