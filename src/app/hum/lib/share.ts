/* ---------------------------------------------------------------------------
   Hum — share links

   A beat is small enough to live entirely inside its link (`/hum#b=…`), so
   sharing needs no server and a link can never point at something deleted.
   The hash, not the query, so the payload never reaches the server log.

   Everything decoded here is untrusted: a link can be typed by anyone.
   Decoding validates shape and clamps every value, and returns null rather
   than a half-built beat when anything is off.
   -------------------------------------------------------------------------- */

import {
  BPM_MAX,
  BPM_MIN,
  type Beat,
  DRUM_IDS,
  DRUM_NAMES,
  type DrumId,
  LANES,
  MAX_SOUND_ROWS,
  OFF,
  type Row,
  STEPS,
} from './beat'
import { LFO_TARGETS, NUMERIC_KEYS, type Patch, WAVES, clamp, sanitizePatch } from './patch'

const VERSION = 1
/** Three drums plus the player's sounds; anything longer is not ours. */
const MAX_ROWS = DRUM_IDS.length + MAX_SOUND_ROWS
const MAX_LINK_CHARS = 8000

export interface Shared {
  beat: Beat
  /** The sound that was on the knobs when the link was made. */
  sound: Patch
}

const round = (n: number) => Number(n.toPrecision(4))

function packPatch(p: Patch): (number | string)[] {
  return [
    ...NUMERIC_KEYS.map(k => round(p[k])),
    WAVES.indexOf(p.wave),
    LFO_TARGETS.indexOf(p.lfoTarget),
  ]
}

function unpackPatch(arr: unknown): Patch | null {
  if (!Array.isArray(arr) || arr.length !== NUMERIC_KEYS.length + 2) return null
  const obj: Record<string, unknown> = {}
  NUMERIC_KEYS.forEach((k, i) => (obj[k] = arr[i]))
  obj.wave = WAVES[arr[NUMERIC_KEYS.length] as number]
  obj.lfoTarget = LFO_TARGETS[arr[NUMERIC_KEYS.length + 1] as number]
  return sanitizePatch(obj)
}

function packSteps(steps: number[]): string {
  return steps.map(s => (s === OFF ? '.' : String(s))).join('')
}

function unpackSteps(str: unknown): number[] | null {
  if (typeof str !== 'string' || str.length !== STEPS) return null
  const out: number[] = []
  for (const ch of str) {
    if (ch === '.') out.push(OFF)
    else if (/^[0-9]$/.test(ch) && Number(ch) < LANES) out.push(Number(ch))
    else return null
  }
  return out
}

function toBase64Url(s: string): string {
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
}

export function encodeShared({ beat, sound }: Shared): string {
  const rows = beat.rows.map(r => [
    r.drum ?? '',
    r.drum ? '' : r.name.slice(0, 24),
    packPatch(r.patch),
    packSteps(r.steps),
  ])
  // Names are the only free text; keep the payload ASCII so btoa is safe.
  const json = JSON.stringify([VERSION, Math.round(beat.bpm), rows, packPatch(sound)]).replace(
    /[^\x20-\x7e]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
  return toBase64Url(json)
}

export function decodeShared(payload: string): Shared | null {
  if (!payload || payload.length > MAX_LINK_CHARS) return null
  let data: unknown
  try {
    data = JSON.parse(fromBase64Url(payload))
  } catch {
    return null
  }
  if (
    !Array.isArray(data) ||
    data[0] !== VERSION ||
    typeof data[1] !== 'number' ||
    !Array.isArray(data[2])
  )
    return null
  const rawRows = data[2] as unknown[]
  if (rawRows.length > MAX_ROWS) return null

  const rows: Row[] = []
  const seenDrums = new Set<DrumId>()
  let sounds = 0
  for (const [i, raw] of rawRows.entries()) {
    if (!Array.isArray(raw) || raw.length !== 4) return null
    const [drum, name, packed, steps] = raw
    const patch = unpackPatch(packed)
    const parsedSteps = unpackSteps(steps)
    if (!patch || !parsedSteps) return null
    if (drum) {
      if (!DRUM_IDS.includes(drum as DrumId) || seenDrums.has(drum as DrumId)) return null
      seenDrums.add(drum as DrumId)
      rows.push({
        id: drum as DrumId,
        name: DRUM_NAMES[drum as DrumId],
        drum: drum as DrumId,
        patch,
        steps: parsedSteps,
      })
    } else {
      if (++sounds > MAX_SOUND_ROWS) return null
      const label =
        typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : `Sound ${sounds}`
      rows.push({ id: `shared${i}`, name: label, patch, steps: parsedSteps })
    }
  }

  const sound = unpackPatch(data[3])
  if (!sound) return null
  return { beat: { bpm: clamp(Math.round(data[1] as number), BPM_MIN, BPM_MAX), rows }, sound }
}

/** Read a shared beat out of a location hash like `#b=…`. */
export function sharedFromHash(hash: string): Shared | null {
  const match = /(?:^#|&)b=([A-Za-z0-9_-]+)/.exec(hash)
  return match ? decodeShared(match[1]) : null
}
