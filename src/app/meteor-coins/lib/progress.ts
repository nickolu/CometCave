import { STAGES, type Stage } from '@/app/meteor-coins/lib/stages'

/**
 * Campaign progress: stars and best score per stage, kept in this browser.
 *
 * Stages unlock in order — one star on a stage opens the next. Unlocking
 * only gates the stage map: a shared link to any stage still drops a
 * visitor straight into play.
 *
 * Stored data comes back from localStorage, which a player can edit, so it
 * is parsed defensively: anything malformed is dropped, never trusted.
 */

export type Stars = 0 | 1 | 2 | 3

export type Progress = {
  stars: Record<string, Stars>
  best: Record<string, number>
}

export const STORAGE_KEY = 'meteor-coins:progress'

export function emptyProgress(): Progress {
  return { stars: {}, best: {} }
}

const KNOWN = new Set(STAGES.map(s => s.slug))

export function parseProgress(raw: string | null): Progress {
  const out = emptyProgress()
  if (!raw) return out
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return out
  }
  if (!data || typeof data !== 'object') return out
  const { stars, best } = data as { stars?: unknown; best?: unknown }
  if (stars && typeof stars === 'object') {
    for (const [slug, n] of Object.entries(stars)) {
      if (KNOWN.has(slug) && (n === 0 || n === 1 || n === 2 || n === 3)) out.stars[slug] = n
    }
  }
  if (best && typeof best === 'object') {
    for (const [slug, n] of Object.entries(best)) {
      if (KNOWN.has(slug) && typeof n === 'number' && Number.isFinite(n) && n >= 0)
        out.best[slug] = Math.floor(n)
    }
  }
  return out
}

/**
 * Keeps the better of the stored and new result for a stage. `value` is the
 * run's headline number (higher is better), or null when there's nothing to
 * compare — a target that wasn't reached.
 */
export function recordResult(
  p: Progress,
  slug: string,
  value: number | null,
  stars: Stars
): Progress {
  const best = { ...p.best }
  if (value !== null) best[slug] = Math.max(p.best[slug] ?? 0, value)
  return { stars: { ...p.stars, [slug]: Math.max(p.stars[slug] ?? 0, stars) as Stars }, best }
}

/**
 * Stage 1 is always open; after that, a star on the previous built stage
 * opens the next. Stages that aren't built yet are skipped, so the campaign
 * never stalls on a gap. A stage already played stays open, even once a
 * stage in front of it is built.
 */
export function isUnlocked(p: Progress, stage: Stage): boolean {
  if (stage.number === 1 || p.stars[stage.slug] !== undefined) return true
  const previous = STAGES.filter(s => s.playable && s.number < stage.number).at(-1)
  return previous !== undefined && (p.stars[previous.slug] ?? 0) >= 1
}

export function nextStageAfter(stage: Stage): Stage | undefined {
  return STAGES.find(s => s.number === stage.number + 1)
}

/** The next stage that can be played, skipping any not built yet. */
export function nextPlayableAfter(stage: Stage): Stage | undefined {
  return STAGES.find(s => s.playable && s.number > stage.number)
}

export function readProgressRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Saves progress; returns false where storage is unavailable (private mode). */
export function saveProgress(p: Progress): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    return true
  } catch {
    return false
  }
}

/** For useSyncExternalStore: re-reads when progress changes in this or another tab. */
export function subscribeProgress(onChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
