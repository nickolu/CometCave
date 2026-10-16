/* ---------------------------------------------------------------------------
   Hum — the audio engine

   Web Audio only, no libraries. One voice is:

     tone (osc + detuned osc) ─┐
                               ├─ filter ─ envelope ─ drive ─ wobble ─ volume ─▶ channel
     noise ────────────────────┘

   and a channel is the echo that a voice plays into. Every channel feeds the
   master chain, whose last stages exist for safety, not sound: resonance and
   echo feedback can stack into a squeal, and this is an all-ages app with
   headphones in the room (docs/hum-design.md §6).

     channels ─ mix ─ limiter ─ ceiling ─ analyser ─ mute ─▶ speakers

   The scope reads the analyser, which sits BEFORE mute, so a muted player
   still sees everything.
   -------------------------------------------------------------------------- */

import type { Patch } from './patch'

/** One voice at full volume peaks here, comfortably under the limiter, so
 *  in the lessons "twice the knob" really draws twice the height. */
export const VOICE_PEAK = 0.42

export class Engine {
  readonly ctx: AudioContext
  readonly mix: GainNode
  readonly analyser: AnalyserNode
  private readonly mute: GainNode
  readonly noise: AudioBuffer
  private readonly channels = new Map<string, Channel>()
  private readonly driveCurves = new Map<number, Float32Array<ArrayBuffer>>()

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.mix = ctx.createGain()
    this.mix.gain.value = VOICE_PEAK

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.15

    // A brick wall behind the limiter: whatever slips past its attack time
    // is rounded off below full scale rather than reaching the ear.
    const ceiling = ctx.createWaveShaper()
    ceiling.curve = ceilingCurve()

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 4096

    this.mute = ctx.createGain()

    this.mix.connect(limiter)
    limiter.connect(ceiling)
    ceiling.connect(this.analyser)
    this.analyser.connect(this.mute)
    this.mute.connect(ctx.destination)

    this.noise = whiteNoise(ctx)
  }

  setMuted(muted: boolean): void {
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01)
  }

  channel(id: string): Channel {
    let ch = this.channels.get(id)
    if (!ch) {
      ch = new Channel(this)
      this.channels.set(id, ch)
    }
    return ch
  }

  /** tanh(k·x)/tanh(k): identity at k→0, a near-square at high k, and the
   *  peak always maps to itself, so drive changes shape, not loudness. */
  driveCurve(drive: number): Float32Array<ArrayBuffer> | null {
    const q = Math.round(drive * 50)
    if (q === 0) return null
    let curve = this.driveCurves.get(q)
    if (!curve) {
      const k = (q / 50) * 15
      const n = 1024
      curve = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1
        curve[i] = Math.tanh(k * x) / Math.tanh(k)
      }
      this.driveCurves.set(q, curve)
    }
    return curve
  }
}

/** Unity up to 0.8, then a soft knee that never passes 0.95.
 *
 *  A WaveShaper always spreads its curve across inputs −1..1 and holds the
 *  end values beyond that, so index i must stand for input −1 + 2i/(n−1).
 *  (The first version spread it across ±2, which doubled every signal on
 *  its way to the speakers and flattened anything loud.) */
export function ceilingCurve(): Float32Array<ArrayBuffer> {
  const n = 2049
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= 0.8 ? a : 0.8 + 0.15 * Math.tanh((a - 0.8) / 0.15)
    curve[i] = Math.sign(x) * y
  }
  return curve
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

// --- Echo channel ------------------------------------------------------------

export class Channel {
  readonly input: GainNode
  private readonly delay: DelayNode
  private readonly feedback: GainNode
  private readonly wet: GainNode

  constructor(engine: Engine) {
    const { ctx } = engine
    this.input = ctx.createGain()
    this.delay = ctx.createDelay(2)
    this.feedback = ctx.createGain()
    this.wet = ctx.createGain()
    this.wet.gain.value = 0

    this.input.connect(engine.mix)
    this.input.connect(this.delay)
    this.delay.connect(this.feedback)
    this.feedback.connect(this.delay)
    this.delay.connect(this.wet)
    this.wet.connect(engine.mix)
  }

  update(p: Patch, at: number): void {
    this.delay.delayTime.setTargetAtTime(p.delayTime, at, 0.02)
    this.feedback.gain.setTargetAtTime(p.delayFeedback, at, 0.02)
    this.wet.gain.setTargetAtTime(p.delayMix, at, 0.02)
  }
}

// --- Voice -------------------------------------------------------------------

/** Loudness the envelope has reached `dt` seconds after the note began,
 *  matching what `start` schedules. Needed to release smoothly from the
 *  middle of a note in browsers without cancelAndHoldAtTime. */
export function envelopeAt(p: Patch, dt: number): number {
  if (dt <= 0) return 0
  if (dt < p.attack) return dt / p.attack
  return p.sustain + (1 - p.sustain) * Math.exp(-(dt - p.attack) / (p.decay / 3))
}

/** How long after the note began the pitch-drop slide lands. */
export const dropTime = (p: Patch) => Math.max(0.03, p.decay * 0.5)

export class Voice {
  private readonly engine: Engine
  private patch: Patch
  private freq: number
  private startedAt = 0
  private stopped = false

  private readonly osc1: OscillatorNode
  private readonly osc2: OscillatorNode
  private readonly g1: GainNode
  private readonly g2: GainNode
  private readonly tone: GainNode
  private readonly noiseSrc: AudioBufferSourceNode
  private readonly noiseGain: GainNode
  private readonly filter: BiquadFilterNode
  private readonly amp: GainNode
  private readonly shaper: WaveShaperNode
  private readonly tremolo: GainNode
  private readonly vol: GainNode
  private readonly lfo: OscillatorNode
  private readonly lfoGain: GainNode
  private lfoTarget: Patch['lfoTarget'] | null = null

  constructor(engine: Engine, channel: Channel, patch: Patch, freq: number) {
    const { ctx } = engine
    this.engine = engine
    this.patch = patch
    this.freq = freq

    this.osc1 = ctx.createOscillator()
    this.osc2 = ctx.createOscillator()
    this.g1 = ctx.createGain()
    this.g2 = ctx.createGain()
    this.tone = ctx.createGain()
    this.noiseSrc = ctx.createBufferSource()
    this.noiseSrc.buffer = engine.noise
    this.noiseSrc.loop = true
    this.noiseGain = ctx.createGain()
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.amp = ctx.createGain()
    this.amp.gain.value = 0
    this.shaper = ctx.createWaveShaper()
    this.shaper.oversample = '2x'
    this.tremolo = ctx.createGain()
    this.vol = ctx.createGain()
    this.lfo = ctx.createOscillator()
    this.lfoGain = ctx.createGain()

    this.osc1.connect(this.g1).connect(this.tone)
    this.osc2.connect(this.g2).connect(this.tone)
    this.tone.connect(this.filter)
    this.noiseSrc.connect(this.noiseGain).connect(this.filter)
    this.filter
      .connect(this.amp)
      .connect(this.shaper)
      .connect(this.tremolo)
      .connect(this.vol)
      .connect(channel.input)
    this.lfo.connect(this.lfoGain)

    this.apply(patch, ctx.currentTime, true)
  }

  private apply(p: Patch, at: number, immediate: boolean): void {
    const set = (param: AudioParam, v: number) =>
      immediate ? param.setValueAtTime(v, at) : param.setTargetAtTime(v, at, 0.015)

    this.osc1.type = p.wave
    this.osc2.type = p.wave
    set(this.osc2.detune, p.detune)
    // The two tones share one unit of loudness, so adding the second never
    // makes the sound louder — only thicker, and beating when detuned.
    set(this.g1.gain, 1 / (1 + p.osc2))
    set(this.g2.gain, p.osc2 / (1 + p.osc2))
    set(this.tone.gain, 1 - p.noise)
    set(this.noiseGain.gain, p.noise)
    set(this.filter.frequency, p.cutoff)
    set(this.filter.Q, p.resonance)
    this.shaper.curve = this.engine.driveCurve(p.drive)
    set(this.vol.gain, p.volume)

    set(this.lfo.frequency, p.lfoRate)
    if (p.lfoTarget !== this.lfoTarget) {
      if (this.lfoTarget) this.lfoGain.disconnect()
      if (p.lfoTarget === 'pitch') {
        this.lfoGain.connect(this.osc1.detune)
        this.lfoGain.connect(this.osc2.detune)
      } else if (p.lfoTarget === 'volume') {
        this.lfoGain.connect(this.tremolo.gain)
      } else {
        this.lfoGain.connect(this.filter.detune)
      }
      this.lfoTarget = p.lfoTarget
    }
    const depth = p.lfoDepth
    if (p.lfoTarget === 'pitch') {
      set(this.lfoGain.gain, depth * 100) // up to a semitone either way
      set(this.tremolo.gain, 1)
    } else if (p.lfoTarget === 'volume') {
      set(this.lfoGain.gain, depth / 2)
      set(this.tremolo.gain, 1 - depth / 2)
    } else {
      set(this.lfoGain.gain, depth * 2400) // up to two octaves either way
      set(this.tremolo.gain, 1)
    }
  }

  start(at: number): void {
    const p = this.patch
    this.startedAt = at
    for (const osc of [this.osc1, this.osc2]) {
      if (p.pitchDrop > 0.005) {
        osc.frequency.setValueAtTime(this.freq * (1 + p.pitchDrop * 7), at)
        osc.frequency.exponentialRampToValueAtTime(this.freq, at + dropTime(p))
      } else {
        osc.frequency.setValueAtTime(this.freq, at)
      }
    }
    const g = this.amp.gain
    g.setValueAtTime(0, at)
    g.linearRampToValueAtTime(1, at + p.attack)
    g.setTargetAtTime(p.sustain, at + p.attack, p.decay / 3)

    this.osc1.start(at)
    this.osc2.start(at)
    this.lfo.start(at)
    // Start somewhere random in the buffer so repeated hats aren't identical.
    this.noiseSrc.start(at, Math.random() * 1.5)
  }

  /** Live knob changes while a held note sounds. */
  update(p: Patch, freq: number): void {
    const now = this.engine.ctx.currentTime
    const prev = this.patch
    this.patch = p
    this.apply(p, now, false)
    if (freq !== this.freq) {
      this.freq = freq
      this.osc1.frequency.setTargetAtTime(freq, now, 0.015)
      this.osc2.frequency.setTargetAtTime(freq, now, 0.015)
    }
    // Past the attack, the note is sitting at sustain: move it there.
    if (
      !this.stopped &&
      now > this.startedAt + p.attack &&
      (p.sustain !== prev.sustain || p.decay !== prev.decay)
    ) {
      this.amp.gain.setTargetAtTime(p.sustain, now, Math.max(0.01, p.decay / 3))
    }
  }

  stop(at: number): void {
    if (this.stopped) return
    this.stopped = true
    const p = this.patch
    const g = this.amp.gain
    const from = Math.max(at, this.engine.ctx.currentTime)
    if (typeof g.cancelAndHoldAtTime === 'function') {
      g.cancelAndHoldAtTime(from)
    } else {
      g.cancelScheduledValues(from)
      g.setValueAtTime(envelopeAt(p, from - this.startedAt), from)
    }
    g.setTargetAtTime(0, from, p.release / 4)
    const end = from + p.release * 1.6 + 0.05
    for (const node of [this.osc1, this.osc2, this.lfo, this.noiseSrc]) node.stop(end)
    this.osc1.onended = () => {
      for (const node of [
        this.osc1,
        this.osc2,
        this.g1,
        this.g2,
        this.tone,
        this.noiseSrc,
        this.noiseGain,
        this.filter,
        this.amp,
        this.shaper,
        this.tremolo,
        this.vol,
        this.lfo,
        this.lfoGain,
      ]) {
        node.disconnect()
      }
    }
  }
}

/** Play one note of `length` seconds. Used by the sequencer. */
export function playNote(
  engine: Engine,
  channel: Channel,
  patch: Patch,
  freq: number,
  at: number,
  length: number
): void {
  channel.update(patch, at)
  const voice = new Voice(engine, channel, patch, freq)
  voice.start(at)
  voice.stop(at + length)
}

// --- The one shared context ------------------------------------------------

let engine: Engine | null = null

/** Create (or resume) the engine. Must be called from a user gesture:
 *  browsers keep audio locked until the page has been tapped. */
export function unlockEngine(): Engine | null {
  if (typeof window === 'undefined') return null
  try {
    if (!engine) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      engine = new Engine(new Ctor())
    }
    if (engine.ctx.state === 'suspended') void engine.ctx.resume()
    return engine
  } catch {
    return null
  }
}

export function currentEngine(): Engine | null {
  return engine
}
