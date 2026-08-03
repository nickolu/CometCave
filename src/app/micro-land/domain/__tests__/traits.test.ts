import { afterEach, describe, expect, it } from 'vitest'

import { makeRng } from '@/app/micro-land/domain/sim/prng'
import {
  NEUTRAL_TINT,
  SHADE_MAX,
  SHADE_MIN,
  TRAIT_MAX,
  TRAIT_MIN,
  inherit,
  neutralTraits,
  notableTraits,
  tintFromKey,
  tintKey,
  traitPhrases,
} from '@/app/micro-land/domain/traits'
import { resetTuning, setTuning } from '@/app/micro-land/domain/tuning'
import type { Traits } from '@/app/micro-land/domain/types'

afterEach(resetTuning)

const rng = makeRng(4242)

function traits(patch: Partial<Traits>): Traits {
  return { ...neutralTraits(), ...patch }
}

describe('inherit', () => {
  it('keeps a child near the midpoint of its two parents', () => {
    const fast = traits({ speed: 1.4 })
    const slow = traits({ speed: 1.0 })
    for (let i = 0; i < 200; i++) {
      const child = inherit(fast, slow, rng)
      // Midpoint 1.2, plus at most one drift step either way.
      expect(child.speed).toBeGreaterThanOrEqual(1.2 - 0.12 - 1e-9)
      expect(child.speed).toBeLessThanOrEqual(1.2 + 0.12 + 1e-9)
    }
  })

  it('drifts from the single parent when there is no partner', () => {
    const parent = traits({ sight: 1.3 })
    for (let i = 0; i < 200; i++) {
      const child = inherit(parent, null, rng)
      expect(child.sight).toBeGreaterThanOrEqual(1.3 - 0.12 - 1e-9)
      expect(child.sight).toBeLessThanOrEqual(1.3 + 0.12 + 1e-9)
    }
  })

  /**
   * The reason the clamp exists. A line under relentless selection would
   * otherwise walk to whatever number a long enough session produces, and both
   * speed and sight feed systems tuned against the blueprint's value.
   */
  it('never escapes the clamp, however long the line runs', () => {
    let line = traits({ speed: TRAIT_MAX, sight: TRAIT_MIN, lifespan: TRAIT_MAX })
    for (let i = 0; i < 2000; i++) {
      line = inherit(line, line, rng)
      expect(line.speed).toBeLessThanOrEqual(TRAIT_MAX)
      expect(line.speed).toBeGreaterThanOrEqual(TRAIT_MIN)
      expect(line.sight).toBeGreaterThanOrEqual(TRAIT_MIN)
      expect(line.lifespan).toBeLessThanOrEqual(TRAIT_MAX)
      expect(line.shade).toBeGreaterThanOrEqual(SHADE_MIN)
      expect(line.shade).toBeLessThanOrEqual(SHADE_MAX)
    }
  })

  /**
   * Two parents that look the same colour must produce a child that looks the
   * same colour. A naive average puts 350° and 10° at 180° — the opposite side
   * of the wheel — so a pair of red creatures would have a cyan baby.
   */
  it('averages hue the short way around the circle', () => {
    const a = traits({ hue: 350 })
    const b = traits({ hue: 10 })
    for (let i = 0; i < 100; i++) {
      const child = inherit(a, b, rng)
      const fromZero = Math.min(child.hue, 360 - child.hue)
      expect(fromZero).toBeLessThan(30)
    }
  })

  it('keeps hue on the circle', () => {
    let line = traits({ hue: 355 })
    for (let i = 0; i < 500; i++) {
      line = inherit(line, null, rng)
      expect(line.hue).toBeGreaterThanOrEqual(0)
      expect(line.hue).toBeLessThan(360)
    }
  })

  it('stops entirely when the drift knob is at zero', () => {
    setTuning({ traitDrift: 0 })
    let line = neutralTraits()
    for (let i = 0; i < 50; i++) line = inherit(line, line, rng)
    expect(line).toEqual(neutralTraits())
  })
})

describe('tint buckets', () => {
  it('puts a neutral creature in the neutral bucket, which recolors nothing', () => {
    expect(tintKey(neutralTraits())).toBe(NEUTRAL_TINT)
    const { hue, shade } = tintFromKey(NEUTRAL_TINT)
    expect(hue).toBe(0)
    expect(shade).toBeCloseTo(1)
  })

  it('separates hues far enough apart to see', () => {
    expect(tintKey(traits({ hue: 10 }))).not.toBe(tintKey(traits({ hue: 190 })))
  })

  it('collapses hues too close together to see, so the cache stays a cache', () => {
    expect(tintKey(traits({ hue: 1 }))).toBe(tintKey(traits({ hue: 9 })))
  })

  it('survives a hue at either end of the circle', () => {
    for (const hue of [0, 359.999, 360, -0.001]) {
      const key = tintKey(traits({ hue }))
      expect(Number.isFinite(key)).toBe(true)
      expect(key).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('what the panel says', () => {
  it('says nothing at all about a creature that was placed rather than born', () => {
    expect(traitPhrases(neutralTraits())).toEqual([])
    expect(notableTraits(neutralTraits())).toEqual([])
  })

  it('agrees with itself about what is worth mentioning', () => {
    // A phrase with no number under it, or a number with no phrase, reads as a
    // broken panel — the two share one threshold precisely to prevent that.
    for (const speed of [0.6, 0.85, 0.91, 1, 1.09, 1.15, 1.6]) {
      const t = traits({ speed })
      const hasPhrase = traitPhrases(t).length > 0
      const hasNumber = notableTraits(t).length > 0
      expect(hasPhrase, `speed ${speed}`).toBe(hasNumber)
    }
  })

  it('names the direction, not just the difference', () => {
    expect(traitPhrases(traits({ speed: 1.4 }))).toContain('quicker than most')
    expect(traitPhrases(traits({ speed: 0.7 }))).toContain('slower than most')
    expect(traitPhrases(traits({ lifespan: 1.4 }))).toContain('long-lived')
  })
})
