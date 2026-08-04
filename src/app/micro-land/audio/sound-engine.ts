/**
 * Procedural audio for sim events.
 *
 * All synthesis is done via the Web Audio API — no files, no buffers.
 * AudioContext is created lazily on the first call to `enable()`, which
 * must happen inside a user-gesture handler (the HUD toggle).
 *
 * At most three OscillatorNodes play simultaneously. A fourth event while
 * three are active is silently dropped — a brief clip is better than
 * compounding into a wall of noise.
 */
let ctx: AudioContext | null = null
let enabled = false
let active = 0

export function enableSound(): void {
  enabled = true
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

export function disableSound(): void {
  enabled = false
}

export function isSoundEnabled(): boolean {
  return enabled
}

/**
 * Schedule one oscillator burst.
 *
 * @param freq      Starting frequency in Hz
 * @param freqEnd   End frequency (for glide); pass same as freq for steady pitch
 * @param duration  Duration in seconds (≤ 0.3 per acceptance criteria)
 * @param type      Oscillator waveform
 * @param peak      Peak gain (0–1)
 * @param startOffset  Seconds from now to start (for arpeggios)
 */
function tone(
  freq: number,
  freqEnd: number,
  duration: number,
  type: OscillatorType = 'sine',
  peak: number = 0.12,
  startOffset: number = 0
): void {
  if (!enabled || !ctx || active >= 3) return
  active++
  const now = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (freqEnd !== freq) osc.frequency.linearRampToValueAtTime(freqEnd, now + duration)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.01)
  gain.gain.linearRampToValueAtTime(0, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
  osc.onended = () => { active = Math.max(0, active - 1) }
}

/**
 * Soft ascending chime when a creature eats.
 *
 * Frequency is derived from the species hue so herbivores in a meadow
 * have a different pitch from carnivores on a savanna — the world starts
 * sounding like itself rather than playing the same clip for everything.
 */
export function playEat(hue: number): void {
  const base = 440 + (hue / 360) * 440   // 440–880 Hz
  tone(base, base * 1.15, 0.12, 'sine', 0.09)
}

/** Low descending tone for any creature death. */
export function playDeath(): void {
  tone(200, 110, 0.25, 'triangle', 0.1)
}

/**
 * Harmonic pair for a birth.
 *
 * Two tones a major third apart, the second slightly delayed, so it
 * reads as a brief chord rather than two unrelated clicks.
 */
export function playBorn(): void {
  tone(523, 523, 0.12, 'sine', 0.09)         // C5
  tone(659, 659, 0.10, 'sine', 0.07, 0.06)   // E5, starts 60 ms later
}

/**
 * Slow descending arpeggio for a species going extinct.
 *
 * Three notes drop over ~0.3 s. Uses the 'triangle' waveform for a
 * slightly hollow, mournful quality compared to the bright sine of a birth.
 */
export function playExtinction(): void {
  tone(330, 330, 0.15, 'triangle', 0.11)
  tone(277, 277, 0.15, 'triangle', 0.09, 0.10)
  tone(220, 220, 0.20, 'triangle', 0.09, 0.20)
}
