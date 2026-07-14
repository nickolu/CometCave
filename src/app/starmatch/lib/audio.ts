/* ---------------------------------------------------------------------------
   Starmatch — tiny WebAudio synth
   Juice lives INSIDE the game (CometCave Principle 2). Voice never *depends*
   on sound (Principle 4): every cue has a visual twin, and audio starts muted-
   safe — nothing plays until the player has gestured and left sound on.
   -------------------------------------------------------------------------- */

let ctx: AudioContext | null = null
let muted = false

export function setMuted(value: boolean): void {
  muted = value
}

export function isMuted(): boolean {
  return muted
}

/** Lazily unlock the AudioContext — must be called from a user gesture. */
export function unlock(): void {
  if (muted) return
  audioCtx()
}

function audioCtx(): AudioContext | null {
  if (muted) return null
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType, when = 0, gain = 0.18): void {
  const a = audioCtx()
  if (!a) return
  const t0 = a.currentTime + when
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const sfx = {
  buzz: () => tone(520, 0.09, 'square', 0, 0.14),
  correct: () => {
    tone(660, 0.12, 'triangle', 0, 0.2)
    tone(990, 0.18, 'triangle', 0.1, 0.2)
  },
  wrong: () => tone(150, 0.22, 'sawtooth', 0, 0.16),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', i * 0.12, 0.2)),
}
