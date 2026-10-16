/* ---------------------------------------------------------------------------
   Hum — what one browser remembers

   Lessons done, the sound on the knobs, the beat and the saved
   sounds, all in localStorage (docs/hum-design.md §5). The beat is stored
   as a share payload, so a stored beat and a shared beat go through exactly
   the same validation on the way back in.
   -------------------------------------------------------------------------- */

import { type Beat, starterBeat } from './beat'
import { DEFAULT_PATCH, type Patch, clamp, sanitizePatch } from './patch'
import { decodeShared, encodeShared } from './share'

const KEY = 'hum:v1'
export const LIBRARY_MAX = 12

export interface SavedSound {
  id: string
  name: string
  patch: Patch
}

export interface HumState {
  /** Lessons finished, 0..LESSONS.length. */
  completed: number
  /** Skipped ahead to the full studio without finishing the lessons. */
  studio: boolean
  sound: Patch
  beat: Beat
  library: SavedSound[]
}

export function freshState(): HumState {
  return {
    completed: 0,
    studio: false,
    sound: { ...DEFAULT_PATCH },
    beat: starterBeat(),
    library: [],
  }
}

export function loadState(maxLessons: number): HumState {
  const fresh = freshState()
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return fresh
  }
  if (!raw || typeof raw !== 'object') return fresh
  const r = raw as Record<string, unknown>

  const shared = typeof r.beat === 'string' ? decodeShared(r.beat) : null
  const library = Array.isArray(r.library)
    ? r.library
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .slice(0, LIBRARY_MAX)
        .map((s, i) => ({
          id: typeof s.id === 'string' ? s.id : `saved${i}`,
          name:
            typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 24) : `Sound ${i + 1}`,
          patch: sanitizePatch(s.patch),
        }))
    : []

  return {
    completed: typeof r.completed === 'number' ? clamp(Math.floor(r.completed), 0, maxLessons) : 0,
    studio: r.studio === true,
    sound: shared ? shared.sound : fresh.sound,
    beat: shared ? shared.beat : fresh.beat,
    library,
  }
}

export function saveState(state: HumState): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        completed: state.completed,
        studio: state.studio,
        beat: encodeShared({ beat: state.beat, sound: state.sound }),
        library: state.library,
      })
    )
  } catch {
    // Private mode or a full disk: the session still works, it just won't
    // be remembered.
  }
}
