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
    const worlds = await backend.list()
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
 */
export async function adoptWorldsAccount(next: WorldsBackend): Promise<void> {
  if (backend === next) return
  await initShelf()

  const local = state.worlds
  const remote = await next.list()
  const remoteById = new Map(remote.map(w => [w.id, w]))

  backend = next
  publish({ busy: true })

  for (const summary of local) {
    const known = remoteById.get(summary.id)
    if (known && known.updatedAt >= summary.updatedAt) continue
    try {
      const save = await localWorldsBackend.load(summary.id)
      if (save) await next.save(save)
      remoteById.set(summary.id, summary)
    } catch {
      // Offline, or the account shelf is full. Keep going: one world that
      // refuses to upload must not cost the player the rest of them.
    }
  }

  publish({ worlds: order([...remoteById.values()]).slice(0, MAX_SAVED_WORLDS), busy: false })
}

export function setBackend(next: WorldsBackend): void {
  backend = next
  listed = false
  listing = null
  publish({ worlds: [], activeId: null, busy: false, error: null })
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
  state = { worlds: [], activeId: null, busy: false, error: null }
  listeners = new Set()
  listed = false
  listing = null
  takeSnapshot = null
  dirty = false
  if (autosaveTimer !== null) clearTimeout(autosaveTimer)
  autosaveTimer = null
}
