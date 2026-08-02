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
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

import {
  type ChronicleBackend,
  INITIAL_DATA,
  localBackend,
} from './backend'
import {
  CHRONICLE_VERSION,
  type ChronicleData,
  type LandRecord,
  type SpeciesRecord,
  emptyChronicle,
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
let dirty = false
let flushTimer: ReturnType<typeof setTimeout> | null = null

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

/** Swap the storage backend. Called once at startup when accounts land. */
export function setBackend(next: ChronicleBackend): void {
  backend = next
  loaded = false
}

/**
 * Read the chronicle in. Safe to call more than once; only the first does work.
 */
export async function initChronicle(): Promise<ChronicleData> {
  if (loaded) return data
  const stored = await backend.load()
  data = migrate(stored)
  loaded = true
  attachFlushOnHide()
  return data
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
  return {
    version: CHRONICLE_VERSION,
    lands: stored.lands ?? {},
    species: stored.species ?? {},
    milestones: stored.milestones ?? {},
  }
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

export async function flushChronicle(): Promise<void> {
  if (!dirty) return
  dirty = false
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  await backend.save(data)
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
  const summoned = Object.values(data.species).filter((s) => s.blueprint.summoned)
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
export function mergeChronicles(a: ChronicleData, b: ChronicleData): ChronicleData {
  const merged = emptyChronicle()

  for (const id of new Set([...Object.keys(a.lands), ...Object.keys(b.lands)])) {
    const left = a.lands[id] ?? emptyLandRecord()
    const right = b.lands[id] ?? emptyLandRecord()
    const deeper = right.generations > left.generations ? right : left
    merged.lands[id] = {
      elder:
        (right.elder?.seconds ?? 0) > (left.elder?.seconds ?? 0)
          ? right.elder
          : left.elder,
      steadySeconds: Math.max(left.steadySeconds, right.steadySeconds),
      generations: deeper.generations,
      generationsBlueprintId: deeper.generationsBlueprintId,
      generationsSpeciesName: deeper.generationsSpeciesName,
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
