import { describe, expect, it } from 'vitest'

import { VOICE_PEAK, ceilingCurve } from './audio'
import {
  LANES,
  MAX_SOUND_ROWS,
  OFF,
  STEPS,
  laneFreq,
  newSoundRow,
  starterBeat,
  stepSeconds,
} from './beat'
import { type KnobId, LESSONS, unlockedKnobs } from './lessons'
import {
  DEFAULT_PATCH,
  NUMERIC_KEYS,
  type Patch,
  RANGES,
  beatName,
  fromUnit,
  sanitizePatch,
  toUnit,
} from './patch'
import { dueSteps } from './sequencer'
import { decodeShared, encodeShared, sharedFromHash } from './share'

describe('safety ceiling', () => {
  // How a WaveShaperNode reads its curve: inputs −1..1 spread across it.
  const shape = (curve: Float32Array, x: number) => {
    const pos = ((Math.max(-1, Math.min(1, x)) + 1) / 2) * (curve.length - 1)
    const i = Math.floor(pos)
    const t = pos - i
    return curve[i] * (1 - t) + (curve[Math.min(i + 1, curve.length - 1)] ?? 0) * t
  }

  it('passes normal levels through unchanged', () => {
    const curve = ceilingCurve()
    for (const x of [0, 0.1, VOICE_PEAK, -VOICE_PEAK, 0.79])
      expect(shape(curve, x)).toBeCloseTo(x, 3)
  })

  it('never lets anything past 0.95', () => {
    const curve = ceilingCurve()
    for (const x of [0.9, 1, 3, -5]) expect(Math.abs(shape(curve, x))).toBeLessThanOrEqual(0.95)
  })
})

describe('patch', () => {
  it('knob position round-trips for every knob', () => {
    for (const key of NUMERIC_KEYS) {
      for (const u of [0, 0.25, 0.5, 0.9, 1])
        expect(toUnit(key, fromUnit(key, u))).toBeCloseTo(u, 6)
    }
  })

  it('sanitizes junk into a valid patch', () => {
    const p = sanitizePatch({
      pitch: 1e9,
      volume: -3,
      wave: 'kazoo',
      cutoff: NaN,
      lfoTarget: 'filter',
    })
    expect(p.pitch).toBe(RANGES.pitch.max)
    expect(p.volume).toBe(0)
    expect(p.wave).toBe('sine')
    expect(p.cutoff).toBe(DEFAULT_PATCH.cutoff)
    expect(p.lfoTarget).toBe('filter')
    expect(sanitizePatch(null)).toEqual(DEFAULT_PATCH)
  })

  it('names echo times that lock to the beat', () => {
    expect(beatName(0.3, 100)).toBe('1/8 note')
    expect(beatName(0.6, 100)).toBe('1/4 note')
    expect(beatName(0.41, 100)).toBeNull()
  })
})

describe('share links', () => {
  const sound: Patch = {
    ...DEFAULT_PATCH,
    volume: 0.7,
    wave: 'sawtooth',
    cutoff: 900,
    lfoTarget: 'volume',
  }

  it('round-trip a beat and a sound', () => {
    const beat = starterBeat()
    beat.bpm = 128
    beat.rows.push(newSoundRow(sound, 'Wub'))
    const back = decodeShared(encodeShared({ beat, sound }))
    expect(back).not.toBeNull()
    expect(back!.beat.bpm).toBe(128)
    expect(back!.beat.rows.map(r => r.name)).toEqual(['Kick', 'Snare', 'Hi-hat', 'Wub'])
    expect(back!.beat.rows.map(r => r.steps)).toEqual(beat.rows.map(r => r.steps))
    expect(back!.sound.wave).toBe('sawtooth')
    expect(back!.sound.lfoTarget).toBe('volume')
    expect(back!.sound.cutoff).toBeCloseTo(900)
  })

  it('keep non-ASCII names', () => {
    const beat = starterBeat()
    beat.rows.push(newSoundRow(sound, 'Café ♪'))
    expect(decodeShared(encodeShared({ beat, sound }))!.beat.rows[3].name).toBe('Café ♪')
  })

  it('reject anything malformed instead of half-loading it', () => {
    const good = encodeShared({ beat: starterBeat(), sound })
    expect(decodeShared('')).toBeNull()
    expect(decodeShared('not-base64!!')).toBeNull()
    expect(decodeShared(good.slice(0, -6))).toBeNull()
    const tooMany = starterBeat()
    for (let i = 0; i <= MAX_SOUND_ROWS; i++) tooMany.rows.push(newSoundRow(sound, `S${i}`))
    expect(decodeShared(encodeShared({ beat: tooMany, sound }))).toBeNull()
    const badLane = starterBeat()
    badLane.rows[0].steps[0] = LANES
    expect(decodeShared(encodeShared({ beat: badLane, sound }))).toBeNull()
  })

  it('clamp out-of-range values from a hand-edited link', () => {
    const beat = starterBeat()
    beat.bpm = 999
    const back = decodeShared(encodeShared({ beat, sound: { ...sound, delayFeedback: 5 } }))!
    expect(back.beat.bpm).toBe(180)
    expect(back.sound.delayFeedback).toBe(RANGES.delayFeedback.max)
  })

  it('read from a location hash', () => {
    const payload = encodeShared({ beat: starterBeat(), sound })
    expect(sharedFromHash(`#b=${payload}`)).not.toBeNull()
    expect(sharedFromHash('#nothing')).toBeNull()
  })
})

describe('lessons', () => {
  // A way through every goal, using only the knobs that lesson has unlocked.
  // If a lesson's goal can't be reached from its own setup, this fails.
  // A move is knob changes, plus optionally pressing or releasing Play.
  const solutions: Record<string, (Partial<Patch> & { playing?: boolean })[]> = {
    silence: [{ volume: 0.2 }, { volume: 0.4 }],
    pitch: [{ pitch: 440 }, { pitch: 110 }],
    shape: [{ wave: 'triangle' }, { wave: 'square' }, { wave: 'sawtooth' }, { wave: 'sawtooth' }],
    filter: [{ cutoff: 200 }],
    resonance: [{ resonance: 10 }, { cutoff: 300 }, { cutoff: 3000 }],
    'start-stop': [{ attack: 1.5 }, { release: 1.5 }, { playing: false }],
    hold: [{ sustain: 0, decay: 0.3 }, { sustain: 0.5 }],
    'two-voices': [{ osc2: 0.8 }, { detune: 7 }],
    wobble: [
      { lfoDepth: 0.3, lfoRate: 6 },
      { lfoTarget: 'volume', lfoDepth: 0.6 },
    ],
    drums: [
      { noise: 1, decay: 0.08 },
      { noise: 0, pitch: 50, pitchDrop: 0.8, decay: 0.3 },
    ],
    crunch: [{ drive: 0.8 }],
    echo: [{ delayMix: 0.4 }, { delayTime: 0.3 }],
  }

  it('every lesson has a solution', () => {
    expect(Object.keys(solutions).sort()).toEqual(LESSONS.map(l => l.id).sort())
  })

  LESSONS.forEach((lesson, index) => {
    it(`lesson ${index + 1} (${lesson.id}) can be finished with its own knobs`, () => {
      const allowed = unlockedKnobs(index)
      const start = { ...DEFAULT_PATCH, volume: 0.5, ...lesson.setup }
      if (index === 0) start.volume = 0
      let patch = { ...start }
      const memo: Record<string, number> = {}
      let goal = 0
      let playing = true
      for (const { playing: press, ...move } of solutions[lesson.id]) {
        for (const k of Object.keys(move) as KnobId[])
          expect(allowed.has(k), `${lesson.id} touches locked ${k}`).toBe(true)
        patch = { ...patch, ...move }
        if (press !== undefined) playing = press
        // Re-check after each move, as the app does on every change.
        while (
          goal < lesson.goals.length &&
          lesson.goals[goal].check({ patch, start, playing, bpm: 100, memo })
        )
          goal++
      }
      expect(goal).toBe(lesson.goals.length)
    })

    it(`lesson ${index + 1} (${lesson.id}) is not already finished at its start`, () => {
      const start = { ...DEFAULT_PATCH, ...lesson.setup, ...(index === 0 ? { volume: 0 } : {}) }
      const ctx = { patch: start, start, playing: true, bpm: 100, memo: {} }
      expect(lesson.goals[0].check(ctx)).toBe(false)
    })
  })

  it('goal text uses the units the knob readouts show', () => {
    // Readouts print times under a second in ms ("20 ms"), so a goal saying
    // "0.15 s" reads as a different number than the knob shows.
    for (const l of LESSONS)
      for (const g of l.goals) expect(g.text, l.id).not.toMatch(/\b0?\.\d+\s*s\b/)
  })

  it('unlocks knobs cumulatively and everything at the end', () => {
    expect([...unlockedKnobs(0)]).toEqual(['volume'])
    expect(unlockedKnobs(2).has('pitch')).toBe(true)
    expect(unlockedKnobs(LESSONS.length).size).toBe(Object.keys(DEFAULT_PATCH).length)
  })
})

describe('beat', () => {
  it('keeps every lane in C minor pentatonic', () => {
    const allowed = new Set([0, 3, 5, 7, 10])
    for (const base of [55, 100, 220, 333, 1000]) {
      for (let lane = 0; lane < LANES; lane++) {
        const midi = Math.round(69 + 12 * Math.log2(laneFreq(base, lane) / 440))
        expect(allowed.has(((midi % 12) + 12) % 12)).toBe(true)
      }
    }
  })

  it('starter beat is one bar and has a kick on the downbeat', () => {
    const b = starterBeat()
    for (const r of b.rows) expect(r.steps).toHaveLength(STEPS)
    expect(b.rows[0].steps[0]).not.toBe(OFF)
  })
})

describe('sequencer timing', () => {
  it('books every step inside the window, exactly one step apart', () => {
    const dur = stepSeconds(120)
    const { due, next } = dueSteps({ step: 14, time: 1 }, 1 + dur * 3.5, dur)
    expect(due.map(d => d.step)).toEqual([14, 15, 0, 1])
    due.forEach((d, i) => expect(d.time).toBeCloseTo(1 + i * dur, 9))
    expect(next.step).toBe(2)
  })

  it('is correct at the tempo extremes', () => {
    for (const bpm of [60, 180]) {
      const dur = stepSeconds(bpm)
      expect(dur).toBeCloseTo(60 / bpm / 4)
      // One full bar of booking lands back on step 0 exactly one bar later.
      const { next } = dueSteps({ step: 0, time: 0 }, dur * STEPS - 1e-9, dur)
      expect(next.step).toBe(0)
      expect(next.time).toBeCloseTo(dur * STEPS, 9)
    }
  })

  it('books nothing when the window is already covered', () => {
    expect(dueSteps({ step: 3, time: 5 }, 4.9, 0.1).due).toEqual([])
  })
})
