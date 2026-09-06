/**
 * Calendar rules for Clusters.
 *
 * Day one is 2026-06-12, running the puzzle NYT published on 2023-06-12 —
 * a nominal 1096-day offset, expressed in DAYS rather than calendar years
 * because "minus three years" has no answer on 2028-02-29.
 *
 * The offset is only the ANCHOR, not the mapping. Play dates are assigned
 * sequentially at ingest: each usable source puzzle takes the next play
 * date, and a source day we cannot run (an image puzzle, a date the archive
 * never published) is skipped without leaving a hole. So after the first
 * skip the real gap is 1096 days plus however many were skipped, and the
 * authoritative record of what ran when is `source.date` on each stored
 * document — never a recomputation from today's date.
 *
 * We burn one puzzle a day and the archive gains one a day, so the buffer
 * never shrinks.
 */

export const LAUNCH_DATE = '2026-06-12'
export const SOURCE_EPOCH = '2023-06-12'
/** The gap at launch, before any source day is skipped. */
export const NOMINAL_OFFSET_DAYS = 1096

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

/** Parse 'YYYY-MM-DD' as a UTC midnight timestamp. Throws on bad input. */
function toUTC(dateStr: string): number {
  if (!isDateString(dateStr)) throw new Error(`Invalid date: ${dateStr}`)
  const [y, m, d] = dateStr.split('-').map(Number)
  const ts = Date.UTC(y, m - 1, d)
  const back = new Date(ts)
  // Rejects 2023-02-30 and friends, which Date.UTC would silently roll over.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${dateStr}`)
  }
  return ts
}

function fromUTC(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function addDays(dateStr: string, days: number): string {
  return fromUTC(toUTC(dateStr) + days * 86_400_000)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000)
}

/** 1-based ordinal in OUR sequence. 2026-06-12 is puzzle #1. */
export function puzzleNumberFor(playDate: string): number {
  return daysBetween(LAUNCH_DATE, playDate) + 1
}

export function isBeforeLaunch(playDate: string): boolean {
  return daysBetween(LAUNCH_DATE, playDate) < 0
}

export type DateResolution = { ok: true; date: string } | { ok: false; error: string }

/**
 * Resolve the `?date=` a route was asked for. Pure, so the boundary rules
 * are testable without standing up a request: a future puzzle is never
 * served, and neither is a date from before the game existed.
 */
export function resolvePlayDate(raw: string | null | undefined, today: string): DateResolution {
  if (raw == null || raw === '') return { ok: true, date: today }
  if (!isDateString(raw)) return { ok: false, error: 'date must be YYYY-MM-DD.' }
  try {
    if (daysBetween(raw, today) < 0) {
      return { ok: false, error: 'That puzzle has not been published yet.' }
    }
  } catch {
    return { ok: false, error: 'date must be YYYY-MM-DD.' }
  }
  if (isBeforeLaunch(raw)) {
    return { ok: false, error: `Clusters starts on ${LAUNCH_DATE}.` }
  }
  return { ok: true, date: raw }
}

export interface IngestAnchor {
  /** The play date the next usable puzzle will take. */
  nextPlayDate: string
  /** The first source date not yet considered. */
  nextSourceDate: string
}

/**
 * Where an ingest run should pick up.
 *
 * Assignment is append-only: a resumed run continues from the last stored
 * document rather than recomputing the whole mapping, so a source day that
 * fails today can never retroactively shift a puzzle somebody has already
 * played.
 */
export function resumeAnchor(
  last: { date: string; sourceDate: string } | null
): IngestAnchor {
  if (!last) return { nextPlayDate: LAUNCH_DATE, nextSourceDate: SOURCE_EPOCH }
  return {
    nextPlayDate: addDays(last.date, 1),
    nextSourceDate: addDays(last.sourceDate, 1),
  }
}

/** Inclusive list of play dates from `start` to `end`. */
export function playDateRange(start: string, end: string): string[] {
  const n = daysBetween(start, end)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i))
}
