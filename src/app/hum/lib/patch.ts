/* ---------------------------------------------------------------------------
   Hum — the patch

   A sound is a patch: a plain object of numbers. Everything that plays, saves,
   shares or gets checked by a lesson goal works on this one shape, which is
   what lets the share link carry a whole sound (docs/hum-design.md §5).

   Knobs a player hasn't unlocked still have values. Those defaults are chosen
   to be *invisible*: the filter wide open, no wobble, no crunch, no echo, an
   envelope that just turns on and off. So lesson 1 really is one knob.
   -------------------------------------------------------------------------- */

export const WAVES = ['sine', 'triangle', 'square', 'sawtooth'] as const
export type Wave = (typeof WAVES)[number]

export const LFO_TARGETS = ['pitch', 'volume', 'filter'] as const
export type LfoTarget = (typeof LFO_TARGETS)[number]

export interface Patch {
  volume: number
  pitch: number
  wave: Wave
  cutoff: number
  resonance: number
  attack: number
  decay: number
  sustain: number
  release: number
  osc2: number
  detune: number
  lfoRate: number
  lfoDepth: number
  lfoTarget: LfoTarget
  noise: number
  pitchDrop: number
  drive: number
  delayTime: number
  delayFeedback: number
  delayMix: number
}

export type NumericKey = { [K in keyof Patch]: Patch[K] extends number ? K : never }[keyof Patch]

/** Range and response curve of every numeric field. `log` knobs turn in
 *  musical steps — each bit of turn multiplies rather than adds — which is
 *  how ears hear pitch and brightness. */
export const RANGES: Record<NumericKey, { min: number; max: number; log?: boolean }> = {
  volume: { min: 0, max: 1 },
  pitch: { min: 40, max: 1760, log: true },
  cutoff: { min: 60, max: 12000, log: true },
  resonance: { min: 0.5, max: 20, log: true },
  attack: { min: 0.002, max: 3, log: true },
  decay: { min: 0.02, max: 3, log: true },
  sustain: { min: 0, max: 1 },
  release: { min: 0.02, max: 4, log: true },
  osc2: { min: 0, max: 1 },
  detune: { min: 0, max: 50 },
  lfoRate: { min: 0.1, max: 20, log: true },
  lfoDepth: { min: 0, max: 1 },
  noise: { min: 0, max: 1 },
  pitchDrop: { min: 0, max: 1 },
  drive: { min: 0, max: 1 },
  delayTime: { min: 0.05, max: 1.2, log: true },
  delayFeedback: { min: 0, max: 0.85 },
  delayMix: { min: 0, max: 1 },
}

export const NUMERIC_KEYS = Object.keys(RANGES) as NumericKey[]

export const DEFAULT_PATCH: Patch = {
  volume: 0,
  pitch: 220,
  wave: 'sine',
  cutoff: 12000,
  resonance: 0.7,
  attack: 0.005,
  decay: 0.1,
  sustain: 1,
  release: 0.05,
  osc2: 0,
  detune: 0,
  lfoRate: 5,
  lfoDepth: 0,
  lfoTarget: 'pitch',
  noise: 0,
  pitchDrop: 0,
  drive: 0,
  delayTime: 0.3,
  delayFeedback: 0.35,
  delayMix: 0,
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Knob position (0..1) ↔ value. */
export function toUnit(key: NumericKey, value: number): number {
  const { min, max, log } = RANGES[key]
  if (log) return clamp(Math.log(value / min) / Math.log(max / min), 0, 1)
  return clamp((value - min) / (max - min), 0, 1)
}

export function fromUnit(key: NumericKey, unit: number): number {
  const { min, max, log } = RANGES[key]
  const u = clamp(unit, 0, 1)
  if (log) return min * Math.pow(max / min, u)
  return min + (max - min) * u
}

/** Coerce anything into a valid patch. Used on everything read back from
 *  storage or a share link, both of which are untrusted. */
export function sanitizePatch(input: unknown): Patch {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out: Patch = { ...DEFAULT_PATCH }
  for (const key of NUMERIC_KEYS) {
    const v = src[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = clamp(v, RANGES[key].min, RANGES[key].max)
    }
  }
  if (WAVES.includes(src.wave as Wave)) out.wave = src.wave as Wave
  if (LFO_TARGETS.includes(src.lfoTarget as LfoTarget)) out.lfoTarget = src.lfoTarget as LfoTarget
  return out
}

// --- Plain-words readouts ------------------------------------------------

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

export function noteName(freq: number): string {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440))
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

function seconds(s: number): string {
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function hz(f: number): string {
  return f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${Math.round(f)} Hz`
}

/** Short printed value + a plain word, e.g. "220 Hz · A3". */
export function readout(key: NumericKey, p: Patch, bpm: number): string {
  const v = p[key]
  switch (key) {
    case 'volume':
      return v <= 0.001 ? 'silent' : `${pct(v)} · ${(20 * Math.log10(v)).toFixed(0)} dB`
    case 'pitch':
      return `${hz(v)} · ${noteName(v)}`
    case 'cutoff':
      return `${hz(v)} · ${v > 8000 ? 'open' : v > 2000 ? 'bright' : v > 600 ? 'soft' : 'muffled'}`
    case 'resonance':
      return `${v.toFixed(1)} · ${v > 10 ? 'whistling' : v > 4 ? 'peaky' : 'flat'}`
    case 'attack':
    case 'decay':
    case 'release':
      return seconds(v)
    case 'sustain':
      return pct(v)
    case 'osc2':
      return v < 0.01 ? 'off' : pct(v)
    case 'detune':
      return `${v.toFixed(1)} cents`
    case 'lfoRate':
      return `${v < 1 ? v.toFixed(2) : v.toFixed(1)} per second`
    case 'lfoDepth':
      return v < 0.01 ? 'off' : pct(v)
    case 'noise':
      return v < 0.01 ? 'all tone' : v > 0.99 ? 'all noise' : `${pct(v)} noise`
    case 'pitchDrop':
      return v < 0.01 ? 'off' : `${(1 + v * 7).toFixed(1)}× start`
    case 'drive':
      return v < 0.01 ? 'clean' : v > 0.6 ? `${pct(v)} · clipping` : pct(v)
    case 'delayTime': {
      const beat = beatName(v, bpm)
      return beat ? `${seconds(v)} · ${beat}` : seconds(v)
    }
    case 'delayFeedback':
      return pct(v)
    case 'delayMix':
      return v < 0.01 ? 'off' : pct(v)
  }
}

/** Note lengths an echo can lock to. Lesson 11 checks against these. */
export const BEAT_DIVISIONS = [
  { name: '1/4 note', beats: 1 },
  { name: 'dotted 1/8', beats: 0.75 },
  { name: '1/8 note', beats: 0.5 },
  { name: '1/16 note', beats: 0.25 },
] as const

export function beatName(delaySeconds: number, bpm: number): string | null {
  const beat = 60 / bpm
  for (const d of BEAT_DIVISIONS) {
    if (Math.abs(delaySeconds - beat * d.beats) / (beat * d.beats) <= 0.04) return d.name
  }
  return null
}
