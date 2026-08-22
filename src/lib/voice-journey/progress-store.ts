/**
 * One child's progress through the singing course, kept in Firestore so it
 * follows her between the tablet and the phone.
 *
 * There is no account behind this. The page is unlisted and the document id is
 * fixed, which means the write path is reachable by anyone who finds the API
 * route — so the blast radius is bounded here rather than by a login. Nothing
 * arbitrary can be stored: keys must be item ids the course actually defines,
 * dates must be real dates in a plausible window, and both collections are
 * capped. The worst a stranger can do is tick a checkbox she can untick.
 *
 * `completed` stores only the ticks. Unchecking deletes the key rather than
 * writing `false`, which keeps the document small and makes "how many are done"
 * a key count.
 */
import { getFirestoreDb } from '@/lib/firebase/server'

import { ITEM_IDS } from './curriculum'

/** The single document. There is one singer; a second would get a second id. */
const PROFILE_ID = 'default'
const COLLECTION = 'voiceJourney'

/** Two years of daily practice — far past the sixteen-week course. */
const MAX_LOG_DAYS = 730
/** Guards against a clock-skewed device logging a day that hasn't happened. */
const FUTURE_GRACE_DAYS = 2
/** The course started being usable in 2026; anything older is not a real entry. */
const EARLIEST_LOG_DAY = '2026-01-01'

export interface VoiceJourneyProgress {
  /** Item id → true. Only ticked items are present. */
  completed: Record<string, boolean>
  /** Practice days as local `YYYY-MM-DD`, unique and ascending. */
  log: string[]
  /** Epoch millis of the last write, so a client can tell which state is newer. */
  updatedAt: number
}

export const EMPTY_PROGRESS: VoiceJourneyProgress = { completed: {}, log: [], updatedAt: 0 }

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `YYYY-MM-DD` that round-trips — rejects '2026-02-31' as well as '2026-2-1'. */
function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
}

function latestAcceptableDay(): string {
  const limit = new Date()
  limit.setUTCDate(limit.getUTCDate() + FUTURE_GRACE_DAYS)
  return limit.toISOString().slice(0, 10)
}

/**
 * Everything that comes off the wire goes through here, on the way in and on
 * the way out — a document written before a curriculum edit gets the same
 * treatment as an untrusted request body, so retired item ids stop counting
 * toward her total instead of lingering as an invisible tick.
 */
export function sanitizeProgress(input: unknown): Omit<VoiceJourneyProgress, 'updatedAt'> {
  const raw = isPlainObject(input) ? input : {}

  const completed: Record<string, boolean> = {}
  if (isPlainObject(raw.completed)) {
    for (const [id, done] of Object.entries(raw.completed)) {
      if (done === true && ITEM_IDS.has(id)) completed[id] = true
    }
  }

  const latest = latestAcceptableDay()
  const days = Array.isArray(raw.log) ? raw.log : []
  const log = Array.from(
    new Set(
      days.filter(
        (day): day is string =>
          typeof day === 'string' && isRealDay(day) && day >= EARLIEST_LOG_DAY && day <= latest
      )
    )
  )
    .sort()
    .slice(-MAX_LOG_DAYS)

  return { completed, log }
}

function docRef() {
  return getFirestoreDb().collection(COLLECTION).doc(PROFILE_ID)
}

/** Her progress, or an empty course when she has never opened the page. */
export async function loadProgress(): Promise<VoiceJourneyProgress> {
  const snap = await docRef().get()
  if (!snap.exists) return EMPTY_PROGRESS

  const data = snap.data() ?? {}
  return {
    ...sanitizeProgress(data),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  }
}

/** Writes the whole document and returns exactly what was stored. */
export async function saveProgress(input: unknown): Promise<VoiceJourneyProgress> {
  const clean = sanitizeProgress(input)
  const stored: VoiceJourneyProgress = { ...clean, updatedAt: Date.now() }
  await docRef().set(stored)
  return stored
}
