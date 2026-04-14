'use client'

class SoundEngine {
  private ctx: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('tta-sound-enabled')
        if (stored !== null) this.enabled = JSON.parse(stored)
      }
    } catch {
      // localStorage may not be available during SSR
    }
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  isEnabled() {
    return this.enabled
  }

  /** Soft click for walking. 50ms sine 800->600Hz, gain 0.08 */
  playTap() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.linearRampToValueAtTime(600, now + 0.05)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } catch {
      // fail silently
    }
  }

  /** Chime for events. Two notes C5 (523Hz) then E5 (659Hz), 80ms each, gain 0.15 */
  playEvent() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const notes = [523, 659]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        const start = now + i * 0.08
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.15, start + 0.01)
        gain.gain.linearRampToValueAtTime(0, start + 0.08)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.08)
      })
    } catch {
      // fail silently
    }
  }

  /** Player attacks. White noise burst 60ms, bandpass 200Hz, gain 0.2 */
  playHit() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const bufferSize = ctx.sampleRate * 0.06
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(200, now)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.06)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      source.start(now)
      source.stop(now + 0.06)
    } catch {
      // fail silently
    }
  }

  /** Enemy hits player. White noise 80ms, bandpass 120Hz, gain 0.15 */
  playEnemyHit() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const bufferSize = ctx.sampleRate * 0.08
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(120, now)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.08)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      source.start(now)
      source.stop(now + 0.08)
    } catch {
      // fail silently
    }
  }

  /** Three ascending notes C5/E5/G5, 120ms each staggered, gain 0.2 */
  playVictory() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const notes = [523, 659, 784]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        const start = now + i * 0.12
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.2, start + 0.01)
        gain.gain.linearRampToValueAtTime(0, start + 0.12)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.12)
      })
    } catch {
      // fail silently
    }
  }

  /** Three descending notes G4/Eb4/C4, 150ms each, gain 0.15 */
  playDefeat() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const notes = [392, 311, 262]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        const start = now + i * 0.15
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.15, start + 0.01)
        gain.gain.linearRampToValueAtTime(0, start + 0.15)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.15)
      })
    } catch {
      // fail silently
    }
  }

  /** Four ascending notes C5/E5/G5/C6, 100ms each, gain 0.2 */
  playLevelUp() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const notes = [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        const start = now + i * 0.1
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.2, start + 0.01)
        gain.gain.linearRampToValueAtTime(0, start + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.1)
      })
    } catch {
      // fail silently
    }
  }

  /** Quick ping, sine 1200Hz, 40ms, gain 0.1 */
  playGold() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1200, now)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.04)
    } catch {
      // fail silently
    }
  }

  /** Warm sweep sine 440->880Hz, 200ms, gain 0.12 */
  playHeal() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.linearRampToValueAtTime(880, now + 0.2)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.2)
    } catch {
      // fail silently
    }
  }

  /** Low rumble 80Hz 300ms + high sting 1000->800Hz 100ms, gain 0.2 */
  playBoss() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      // Low rumble
      const oscLow = ctx.createOscillator()
      const gainLow = ctx.createGain()
      oscLow.type = 'sine'
      oscLow.frequency.setValueAtTime(80, now)
      gainLow.gain.setValueAtTime(0.2, now)
      gainLow.gain.linearRampToValueAtTime(0, now + 0.3)
      oscLow.connect(gainLow)
      gainLow.connect(ctx.destination)
      oscLow.start(now)
      oscLow.stop(now + 0.3)
      // High sting
      const oscHigh = ctx.createOscillator()
      const gainHigh = ctx.createGain()
      oscHigh.type = 'sine'
      oscHigh.frequency.setValueAtTime(1000, now)
      oscHigh.frequency.linearRampToValueAtTime(800, now + 0.1)
      gainHigh.gain.setValueAtTime(0.2, now)
      gainHigh.gain.linearRampToValueAtTime(0, now + 0.1)
      oscHigh.connect(gainHigh)
      gainHigh.connect(ctx.destination)
      oscHigh.start(now)
      oscHigh.stop(now + 0.1)
    } catch {
      // fail silently
    }
  }

  /** Detuned beating sines 440+445Hz, 200ms, gain 0.12 */
  playSpellCast() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const freqs = [440, 445]
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.2)
      })
    } catch {
      // fail silently
    }
  }

  /** Critical hit: sharp high note (1000Hz) with metallic ring (detuned 1005Hz), 150ms, gain 0.25 */
  playCritical() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const freqs = [1000, 1005]
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        gain.gain.setValueAtTime(0.25, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.15)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.15)
      })
    } catch {
      // fail silently
    }
  }

  /** Descending G5/E5/C5, 100ms each overlapped, gain 0.1 */
  playCrossroads() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const notes = [784, 659, 523]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        const start = now + i * 0.07
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.1, start + 0.01)
        gain.gain.linearRampToValueAtTime(0, start + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.1)
      })
    } catch {
      // fail silently
    }
  }

  /** Mount acquired fanfare — low note (200Hz) + high sweep (400->800Hz), 300ms, gain 0.2 */
  playMountAcquired() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      // Low note
      const oscLow = ctx.createOscillator()
      const gainLow = ctx.createGain()
      oscLow.type = 'sine'
      oscLow.frequency.setValueAtTime(200, now)
      gainLow.gain.setValueAtTime(0.2, now)
      gainLow.gain.linearRampToValueAtTime(0, now + 0.3)
      oscLow.connect(gainLow)
      gainLow.connect(ctx.destination)
      oscLow.start(now)
      oscLow.stop(now + 0.3)
      // High sweep
      const oscHigh = ctx.createOscillator()
      const gainHigh = ctx.createGain()
      oscHigh.type = 'sine'
      oscHigh.frequency.setValueAtTime(400, now)
      oscHigh.frequency.linearRampToValueAtTime(800, now + 0.3)
      gainHigh.gain.setValueAtTime(0.2, now)
      gainHigh.gain.linearRampToValueAtTime(0, now + 0.3)
      oscHigh.connect(gainHigh)
      gainHigh.connect(ctx.destination)
      oscHigh.start(now)
      oscHigh.stop(now + 0.3)
    } catch {
      // fail silently
    }
  }

  /** Mystical ascending shimmer — two detuned sines sweeping 300->600Hz over 300ms, gain 0.15 */
  playSpellLearn() {
    try {
      if (!this.enabled) return
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const freqs = [300, 305] // Detuned pair for shimmer effect
      freqs.forEach((startFreq) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(startFreq, now)
        osc.frequency.linearRampToValueAtTime(startFreq * 2, now + 0.3)
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.linearRampToValueAtTime(0.08, now + 0.3)
        gain.gain.linearRampToValueAtTime(0, now + 0.5) // Reverb-like tail
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.5)
      })
    } catch {
      // fail silently
    }
  }
}

export const soundEngine = new SoundEngine()
