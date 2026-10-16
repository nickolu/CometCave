/* ---------------------------------------------------------------------------
   Hum — the beat

   One bar of sixteen steps. The three starter drums are ordinary patches,
   built from the same knobs the lessons teach (lesson 9 says so out loud),
   and the player's own sounds join as extra rows.

   Notes on a sound row are scale steps, not pitches. Everything is in
   C minor pentatonic, five notes that never clash with each other, so any
   arrangement of steps sounds like music and no theory is needed.
   -------------------------------------------------------------------------- */

import { DEFAULT_PATCH, type Patch } from './patch'

export const STEPS = 16
export const MAX_SOUND_ROWS = 8
/** Note lanes in a sound row's piano roll, counted up from the sound's own
 *  note. Eight steps of a five-note scale is a little over an octave. */
export const LANES = 8
export const OFF = -1

export const BPM_MIN = 60
export const BPM_MAX = 180
export const BPM_DEFAULT = 100

export type DrumId = 'kick' | 'snare' | 'hat'
export const DRUM_IDS: DrumId[] = ['kick', 'snare', 'hat']

export interface Row {
  id: string
  name: string
  drum?: DrumId
  patch: Patch
  /** Per step: OFF, or the lane (0..LANES-1). Drums only use lane 0. */
  steps: number[]
}

export interface Beat {
  bpm: number
  rows: Row[]
}

export const DRUM_PATCHES: Record<DrumId, Patch> = {
  kick: {
    ...DEFAULT_PATCH,
    volume: 0.95,
    pitch: 50,
    wave: 'sine',
    pitchDrop: 0.85,
    attack: 0.002,
    decay: 0.35,
    sustain: 0,
    release: 0.1,
  },
  snare: {
    ...DEFAULT_PATCH,
    volume: 0.6,
    pitch: 185,
    wave: 'triangle',
    noise: 0.65,
    pitchDrop: 0.25,
    cutoff: 7000,
    attack: 0.002,
    decay: 0.16,
    sustain: 0,
    release: 0.1,
  },
  hat: {
    ...DEFAULT_PATCH,
    volume: 0.32,
    noise: 1,
    attack: 0.002,
    decay: 0.05,
    sustain: 0,
    release: 0.03,
  },
}

export const DRUM_NAMES: Record<DrumId, string> = { kick: 'Kick', snare: 'Snare', hat: 'Hi-hat' }

function pattern(on: number[]): number[] {
  return Array.from({ length: STEPS }, (_, i) => (on.includes(i) ? 0 : OFF))
}

export function starterBeat(): Beat {
  return {
    bpm: BPM_DEFAULT,
    rows: [
      {
        id: 'kick',
        name: DRUM_NAMES.kick,
        drum: 'kick',
        patch: { ...DRUM_PATCHES.kick },
        steps: pattern([0, 8, 10]),
      },
      {
        id: 'snare',
        name: DRUM_NAMES.snare,
        drum: 'snare',
        patch: { ...DRUM_PATCHES.snare },
        steps: pattern([4, 12]),
      },
      {
        id: 'hat',
        name: DRUM_NAMES.hat,
        drum: 'hat',
        patch: { ...DRUM_PATCHES.hat },
        steps: pattern([0, 2, 4, 6, 8, 10, 12, 14]),
      },
    ],
  }
}

export function soundRows(beat: Beat): Row[] {
  return beat.rows.filter(r => !r.drum)
}

/** A new sound row with a simple bassline so it's audible the moment it's
 *  added, rather than an empty row the player has to discover how to fill. */
export function newSoundRow(patch: Patch, name: string): Row {
  const steps = Array.from({ length: STEPS }, () => OFF)
  steps[0] = 0
  steps[6] = 2
  steps[10] = 1
  return {
    id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    name,
    patch: { ...patch },
    steps,
  }
}

// --- The scale ------------------------------------------------------------

const PENTATONIC = [0, 3, 5, 7, 10] // C, E♭, F, G, B♭

/** Every C-minor-pentatonic MIDI note from C1 to C8, ascending. */
const SCALE_MIDI: number[] = []
for (let m = 24; m <= 108; m++) if (PENTATONIC.includes(m % 12)) SCALE_MIDI.push(m)

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440)

/** Index into SCALE_MIDI of the scale note nearest `freq`. */
export function nearestScaleIndex(freq: number): number {
  const m = freqToMidi(freq)
  let best = 0
  for (let i = 1; i < SCALE_MIDI.length; i++) {
    if (Math.abs(SCALE_MIDI[i] - m) < Math.abs(SCALE_MIDI[best] - m)) best = i
  }
  return best
}

/** The frequency a sound plays at on a given lane: its own pitch snapped
 *  into the scale, then `lane` scale steps up. */
export function laneFreq(basePitch: number, lane: number): number {
  const i = Math.min(SCALE_MIDI.length - 1, nearestScaleIndex(basePitch) + lane)
  return midiToFreq(SCALE_MIDI[i])
}

/** Drums keep their exact pitch — a kick tuned between notes is a choice. */
export function rowFreq(row: Row, lane: number): number {
  return row.drum ? row.patch.pitch : laneFreq(row.patch.pitch, lane)
}

export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4
}
