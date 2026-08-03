/**
 * The live chronicle: one in-memory copy, written back on a debounce.
 *
 * The simulation touches records several times a second — every stats push asks
 * "is this the oldest thing that has ever lived here?". Serializing to storage
 * at that rate would be pointless work, so reads and writes hit an in-memory
 * object and the backend only sees it every few seconds, plus once more when the
 * page goes away. Losing the last couple of seconds of a record on a hard crash
 * is an acceptable trade; janking the frame loop is not.
 */
import { lifeKind } from '@/app/micro-land/domain/blueprint'
import { type CreatureBlueprint, LIFE_KINDS, type LifeKind } from '@/app/micro-land/domain/types'
import { CHRONICLE_SYNC_KEY, readSyncMark, writeSyncMark } from '@/app/micro-land/sync-mark'

import { type ChronicleBackend, INITIAL_DATA, localBackend } from './backend'
import {
  CHRONICLE_VERSION,
  type ChronicleData,
  type KindRecord,
  type LandRecord,
  type SpeciesRecord,
  emptyChronicle,
  emptyKindRecord,
  emptyLandRecord,
} from './types'

/** How long writes are allowed to pile up before they reach the backend. */
const FLUSH_DEBOUNCE_MS = 4000

/**
 * Cap on archived *summoned* species.
 *
 * Built-ins are bounded by the config and never pruned. Summoned ones are not
 * bounded by anything — a player could invent hundreds — and each carries its
 * own pixel art, so the archive is trimmed oldest-sighting-first to keep a
 * chronicle comfortably inside a `localStorage` quota.
 */
const MAX_ARCHIVED_SUMMONED = 80

let data: ChronicleData = INITIAL_DATA
let backend: ChronicleBackend = localBackend
let loaded = false
/**
 * The in-flight load, so concurrent callers await one read instead of racing.
 *
 * `loaded` alone is not enough: it is only set *after* the await, so a second
 * caller arriving while the first is still reading storage would sail past the
 * guard and start its own load. Both would then assign to `data`, and the slower
 * one would win — which on the account path means a freshly merged chronicle
 * being quietly replaced by the local-only copy it was merged from.
 */
let loading: Promise<ChronicleData> | null = null
let dirty = false
let flushTimer: ReturnType<typeof setTimeout> | null = null
/** True once `adoptAccount` has moved writes off this device. */
let remote = false
/**
 * The device copy, once the account has taken over the writes.
 *
 * The account is where the chronicle lives after `adoptAccount`, but the local
 * copy is not abandoned — it is kept in step *behind* it, so a player whose
 * account is unreachable next session still opens a game with their records in
 * it. A mirror that stopped being written would be worse than no mirror at all:
 * it freezes at the moment of sign-in and then argues, on every load, for
 * putting back everything deleted since. See `sync-mark.ts`.
 */
let mirror: ChronicleBackend | null = null
/** Whose account `backend` is writing to, so the mark can name it. */
let accountId: string | null = null

// ---------------------------------------------------------------------------
// Save state
// ---------------------------------------------------------------------------

/**
 * What the storage layer is doing, for anything that wants to show it.
 *
 * `remote` rides along on the two settled states because "saved" means something
 * different depending on it: saved to this device only, or saved to an account
 * that another device can read. A player deciding whether their creatures are
 * really safe needs to be told which one they got.
 */
export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number; species: number; remote: boolean }
  | { kind: 'failed'; at: number; remote: boolean }

let saveState: SaveState = { kind: 'idle' }
const saveListeners = new Set<(state: SaveState) => void>()

/**
 * Published rather than pushed into the store directly.
 *
 * This module is imported by the headless harness, which has no React and no
 * Zustand. A listener set keeps the chronicle honest about that — the UI
 * subscribes, the harness does not, and neither knows about the other.
 */
export function onSaveState(fn: (state: SaveState) => void): () => void {
  saveListeners.add(fn)
  fn(saveState)
  return () => saveListeners.delete(fn)
}

export function readSaveState(): SaveState {
  return saveState
}

function setSaveState(next: SaveState): void {
  saveState = next
  for (const fn of saveListeners) fn(next)
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * The key a land's records are filed under.
 *
 * Built-in themes use their own id, so the tidepool always has one set of
 * records however many times it is reshaped. A summoned land is keyed by its
 * *name* rather than the generic `summoned` theme id — the player who described
 * "a drowned cathedral" should find that land's records again next time they
 * summon it, not a pile shared with every other invention.
 */
export function landId(themeId: string, summonedLandName: string | null): string {
  if (summonedLandName) {
    const slug = summonedLandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
    if (slug) return `summoned:${slug}`
  }
  return themeId
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Swap the storage backend and forget what was loaded. For tests and startup. */
export function setBackend(next: ChronicleBackend): void {
  backend = next
  loaded = false
  loading = null
  remote = false
  mirror = null
  accountId = null
}

/**
 * Move an in-progress session onto an account, keeping both sets of records.
 *
 * The game starts on `localBackend` and never waits for the network, because
 * anonymous-first (CLAUDE.md #1) means a player with no account and no
 * connection still gets a working world. Auth resolves a moment later, and this
 * is what happens then: read what the account already knows, fold the two
 * together, and write the result back.
 *
 * Merging rather than choosing is the whole point, and it is why
 * `mergeChronicles` was written long before there was anything to call it. Both
 * sides are real: the account holds what this player did on their phone last
 * week, the local copy holds what they have done in the last thirty seconds on
 * this laptop. Every record is a high-water mark, so there is no conflict to
 * resolve and nothing to ask the player about.
 *
 * The write-back is unconditional. Even when the account wins on every record,
 * the local archive may hold a creature it has never seen, and that creature is
 * the thing this whole path exists to save.
 *
 * The merge is skipped in exactly one case: when this device's copy is already
 * known to be in step with *this* account (see `sync-mark.ts`). Then the account
 * holds everything the local copy does, plus every deletion made since, so
 * unioning the two would resurrect every creature the player has thrown away —
 * which is what "deleting does not work, it comes back on refresh" was. In that
 * case the account is simply the truth.
 *
 * `stored` being null is deliberately *not* treated as "the account is empty".
 * A dropped connection reads the same way, and the safe answer to both is to
 * keep what this device has and hand it up.
 */
export async function adoptAccount(next: ChronicleBackend, account: string): Promise<void> {
  if (backend === next) return

  // Never merge into a chronicle that hasn't finished loading — the local read
  // would land afterwards and overwrite the merged result with its own half.
  await initChronicle()

  const stored = await next.load()
  const mirrored = readSyncMark(CHRONICLE_SYNC_KEY) === account

  // Whatever was being written before the account took over becomes the mirror —
  // `localBackend` in the game, and whatever a test installed in a test. Adopting
  // a *second* account (a sign-out and back in under another uid) leaves it
  // alone: the device is still the thing to mirror, the account being left
  // behind is not.
  if (!remote) mirror = backend
  backend = next
  accountId = account
  remote = true
  if (stored) data = mirrored ? migrate(stored) : mergeChronicles(migrate(stored), data)

  touch()
  await flushChronicle()
}

/**
 * Read the chronicle in. Safe to call more than once, and safe to call
 * concurrently; only the first does work and the rest await it.
 */
export async function initChronicle(): Promise<ChronicleData> {
  if (loaded) return data
  if (loading) return loading

  loading = (async () => {
    const stored = await backend.load()
    data = migrate(stored)
    loaded = true
    attachFlushOnHide()
    return data
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

/**
 * Bring an old chronicle forward, or start a fresh one.
 *
 * There is only one version so far, so anything unrecognized is discarded
 * rather than guessed at. When version 2 arrives this is where the field-by-
 * field upgrade goes — and note it must never throw, because a chronicle that
 * fails to parse should cost the player their records, not their game.
 */
function migrate(stored: ChronicleData | null): ChronicleData {
  if (!stored || typeof stored !== 'object') return emptyChronicle()
  if (stored.version !== CHRONICLE_VERSION) return emptyChronicle()
  const species = stored.species ?? {}
  const lands: Record<string, LandRecord> = {}
  for (const [id, record] of Object.entries(stored.lands ?? {})) {
    if (record && typeof record === 'object') lands[id] = normalizeLandRecord(record, species)
  }
  return {
    version: CHRONICLE_VERSION,
    lands,
    species,
    milestones: stored.milestones ?? {},
  }
}

/**
 * Which side of the food web an archived species was on, if we can still tell.
 *
 * The blueprint here came out of storage, so it is only a `CreatureBlueprint` by
 * assertion — `isPlantLike` reaches into `move`, `diet` and `tags`, and a
 * half-written archive entry would throw out of `migrate`, which is the one
 * thing `migrate` may never do. Anything that doesn't look like a blueprint is
 * simply unclassifiable.
 */
function kindOfArchived(
  blueprintId: string | null | undefined,
  species: Record<string, SpeciesRecord>
): LifeKind | null {
  if (!blueprintId) return null
  const bp = species[blueprintId]?.blueprint
  if (!bp || typeof bp !== 'object') return null
  if (!bp.move || !bp.diet || !Array.isArray(bp.diet.eats) || !Array.isArray(bp.tags)) return null
  return lifeKind(bp)
}

/**
 * Grow a stored land record into the current shape.
 *
 * `byKind` arrived after version 1 shipped, so every record written before it
 * has to be given one. Filing the old land-wide records into a column rather
 * than starting both columns empty is the point: a player returning to a
 * fourteen-generation line they set last week should find it under Plants, not
 * find it apparently wiped.
 *
 * A holder that can no longer be classified — pruned out of the archive, or
 * deleted by the player — leaves the split empty instead of being guessed into a
 * column. An empty column refills within a minute of play; a plant record parked
 * under Animals is a lie that never expires, because records only ever move
 * upward and nothing would beat it.
 */
function normalizeLandRecord(
  record: LandRecord,
  species: Record<string, SpeciesRecord>
): LandRecord {
  const filled: LandRecord = { ...emptyLandRecord(), ...record }
  if (record.byKind?.plant && record.byKind?.animal) return filled

  const byKind = { plant: emptyKindRecord(), animal: emptyKindRecord() }

  const elderKind = kindOfArchived(record.elder?.blueprintId, species)
  if (record.elder && elderKind) byKind[elderKind].elder = record.elder

  const lineKind = kindOfArchived(record.generationsBlueprintId, species)
  if (record.generations > 0 && lineKind) {
    byKind[lineKind].generations = record.generations
    byKind[lineKind].generationsBlueprintId = record.generationsBlueprintId
    byKind[lineKind].generationsSpeciesName = record.generationsSpeciesName
  }

  return { ...filled, byKind }
}

export function readChronicle(): ChronicleData {
  return data
}

/** Mutate the chronicle in place and schedule a write. */
export function updateChronicle(mutate: (draft: ChronicleData) => void): void {
  mutate(data)
  touch()
}

/**
 * Mark the chronicle as needing a write and start the debounce.
 *
 * Every mutating helper below calls this itself rather than relying on being
 * wrapped in `updateChronicle`. An unwritten record is invisible until the
 * player closes the tab and finds it missing, which is the worst possible time
 * to discover the invariant was broken.
 */
function touch(): void {
  dirty = true
  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      void flushChronicle()
    }, FLUSH_DEBOUNCE_MS)
  }
}

/**
 * Write the chronicle out, and say what happened.
 *
 * The failure handling is the load-bearing part. `dirty` is cleared *before* the
 * write so that records changed while it is in flight are not lost — but if the
 * write then fails, clearing it would mark the chronicle clean when nothing was
 * stored, and those records would never be retried. A dropped connection would
 * silently cost the player everything since the last successful flush. So a
 * failure puts the flag back and re-arms the debounce.
 *
 * Failures are caught rather than thrown, because every caller is a page-hide
 * handler or a fire-and-forget timer and none of them can do anything useful
 * with an exception. Swallowing them *here* rather than inside the backend is
 * the difference between unobservable and merely non-fatal: the state goes to
 * `failed`, the UI can say so, and the next flush tries again.
 */
export async function flushChronicle(): Promise<void> {
  if (!dirty) return
  dirty = false
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  setSaveState({ kind: 'saving' })
  try {
    await backend.save(data)
    /**
     * The device copy trails the account, and only ever on success.
     *
     * Written *after* the account rather than alongside it, so the mark can only
     * ever claim something true: everything on this device is also up there.
     * Mirroring a failed account save would put the device ahead instead, and
     * the next load would merge it back up — which for a deletion means undoing
     * it, the exact bug this is here to close.
     *
     * So a flush that cannot reach the account leaves the device holding the
     * last state that did reach it. The in-memory chronicle keeps the newer one
     * and `dirty` keeps retrying; nothing is lost that was not already lost
     * before this mirror existed.
     */
    if (mirror) {
      await mirror.save(data)
      writeSyncMark(CHRONICLE_SYNC_KEY, accountId)
    }
    setSaveState({
      kind: 'saved',
      at: Date.now(),
      species: Object.keys(data.species).length,
      remote,
    })
  } catch (error) {
    console.warn('micro-land: could not save records —', error)
    // Put it back in the queue. `touch` re-arms the debounce, so a transient
    // failure costs a few seconds rather than the session.
    dirty = true
    touch()
    setSaveState({ kind: 'failed', at: Date.now(), remote })
  }
}

/**
 * Write on the way out.
 *
 * `visibilitychange` rather than `beforeunload`: on mobile a tab is very often
 * backgrounded and then killed without ever firing an unload, which is exactly
 * the case where an unwritten record would be lost.
 */
let hideHooked = false
function attachFlushOnHide(): void {
  if (hideHooked || typeof document === 'undefined') return
  hideHooked = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushChronicle()
  })
  window.addEventListener('pagehide', () => void flushChronicle())
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** The record for a land, created on first access. */
export function landRecord(id: string): LandRecord {
  const existing = data.lands[id]
  if (existing) return existing
  const fresh = emptyLandRecord()
  data.lands[id] = fresh
  return fresh
}

/**
 * Note that a species was seen alive, archiving its blueprint the first time.
 *
 * The blueprint is re-copied on every sighting rather than only on the first:
 * summoning is non-deterministic, so the same id can come back with better art
 * or a fixed diet, and the archive should hold the most recent version.
 */
export function rememberSpecies(bp: CreatureBlueprint, now: number): void {
  const existing = data.species[bp.id]
  if (existing) {
    existing.lastSeen = now
    existing.blueprint = bp
    touch()
    return
  }
  data.species[bp.id] = {
    blueprint: bp,
    firstSeen: now,
    lastSeen: now,
    longestLife: 0,
  }
  pruneArchive()
  touch()
}

/** Record a lifespan against a species, if it beats what that species has done. */
export function noteSpeciesLife(blueprintId: string, seconds: number): boolean {
  const record = data.species[blueprintId]
  if (!record || seconds <= record.longestLife) return false
  record.longestLife = seconds
  touch()
  return true
}

/**
 * Drop a species from the archive, returning what was removed.
 *
 * The returned record is the whole undo: it carries `firstSeen` and
 * `longestLife`, which cannot be reconstructed from the blueprint, so putting it
 * back with `restoreSpeciesRecord` restores the history rather than a creature
 * that claims to have been discovered just now.
 */
export function forgetSpecies(id: string): SpeciesRecord | null {
  const record = data.species[id]
  if (!record) return null
  delete data.species[id]
  touch()
  return record
}

/** Put a forgotten species back exactly as it was. The other half of undo. */
export function restoreSpeciesRecord(record: SpeciesRecord): void {
  data.species[record.blueprint.id] = record
  touch()
}

/** Every archived species, newest sighting first. */
export function archivedSpecies(): SpeciesRecord[] {
  return Object.values(data.species).sort((a, b) => b.lastSeen - a.lastSeen)
}

/** True if this milestone has never fired before; marks it fired if so. */
export function claimMilestone(id: string, now: number): boolean {
  if (data.milestones[id]) return false
  data.milestones[id] = now
  touch()
  return true
}

function pruneArchive(): void {
  const summoned = Object.values(data.species).filter(s => s.blueprint.summoned)
  if (summoned.length <= MAX_ARCHIVED_SUMMONED) return
  summoned.sort((a, b) => a.lastSeen - b.lastSeen)
  const excess = summoned.length - MAX_ARCHIVED_SUMMONED
  for (let i = 0; i < excess; i++) delete data.species[summoned[i].blueprint.id]
}

// ---------------------------------------------------------------------------
// For the account-backed future
// ---------------------------------------------------------------------------

/**
 * Combine two chronicles, keeping the better of each record.
 *
 * Unused today, and written now because it is the one genuinely hard part of
 * moving to accounts: a player will arrive at sign-in holding records they set
 * anonymously, and throwing those away is the wrong answer. Records are all
 * high-water marks, so "keep the larger" merges cleanly — no conflict, no
 * prompt. Milestones keep the earlier timestamp; a first is a first.
 */
/** Keep the better of each record in one column. Same high-water-mark rule. */
function mergeKindRecords(left: KindRecord, right: KindRecord): KindRecord {
  const deeper = right.generations > left.generations ? right : left
  return {
    elder: (right.elder?.seconds ?? 0) > (left.elder?.seconds ?? 0) ? right.elder : left.elder,
    generations: deeper.generations,
    generationsBlueprintId: deeper.generationsBlueprintId,
    generationsSpeciesName: deeper.generationsSpeciesName,
  }
}

export function mergeChronicles(a: ChronicleData, b: ChronicleData): ChronicleData {
  const merged = emptyChronicle()

  for (const id of new Set([...Object.keys(a.lands), ...Object.keys(b.lands)])) {
    const left = a.lands[id] ?? emptyLandRecord()
    const right = b.lands[id] ?? emptyLandRecord()
    const deeper = right.generations > left.generations ? right : left
    // Each column merges on its own, so a phone that holds the animal record and
    // a laptop that holds the plant one end up with both. `byKind` is defaulted
    // per side rather than assumed present: `mergeChronicles` is exported and
    // gets handed records that never went through `migrate`.
    const byKind = {} as Record<LifeKind, KindRecord>
    for (const kind of LIFE_KINDS) {
      byKind[kind] = mergeKindRecords(
        left.byKind?.[kind] ?? emptyKindRecord(),
        right.byKind?.[kind] ?? emptyKindRecord()
      )
    }
    merged.lands[id] = {
      elder: (right.elder?.seconds ?? 0) > (left.elder?.seconds ?? 0) ? right.elder : left.elder,
      steadySeconds: Math.max(left.steadySeconds, right.steadySeconds),
      generations: deeper.generations,
      generationsBlueprintId: deeper.generationsBlueprintId,
      generationsSpeciesName: deeper.generationsSpeciesName,
      byKind,
    }
  }

  for (const id of new Set([...Object.keys(a.species), ...Object.keys(b.species)])) {
    const left = a.species[id]
    const right = b.species[id]
    if (!left || !right) {
      merged.species[id] = (left ?? right) as SpeciesRecord
      continue
    }
    merged.species[id] = {
      // The more recently seen copy is the more current art.
      blueprint: right.lastSeen > left.lastSeen ? right.blueprint : left.blueprint,
      firstSeen: Math.min(left.firstSeen, right.firstSeen),
      lastSeen: Math.max(left.lastSeen, right.lastSeen),
      longestLife: Math.max(left.longestLife, right.longestLife),
    }
  }

  for (const id of new Set([...Object.keys(a.milestones), ...Object.keys(b.milestones)])) {
    const left = a.milestones[id] ?? Infinity
    const right = b.milestones[id] ?? Infinity
    merged.milestones[id] = Math.min(left, right)
  }

  return merged
}
