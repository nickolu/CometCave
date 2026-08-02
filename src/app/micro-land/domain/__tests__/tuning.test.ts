import { afterEach, describe, expect, it } from 'vitest'

import {
  KNOBS,
  TUNING,
  TUNING_DEFAULTS,
  type TuningKey,
  changedKnobs,
  resetTuning,
  setTuning,
} from '@/app/micro-land/domain/tuning'

afterEach(() => {
  // `TUNING` is module state shared by every test in this process, exactly as it
  // is shared by everything in the running game.
  resetTuning()
})

describe('knob table', () => {
  it('covers every tunable value exactly once', () => {
    const keys = KNOBS.map(k => k.key).sort()
    expect(keys).toEqual((Object.keys(TUNING_DEFAULTS) as TuningKey[]).sort())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every default a range that contains it', () => {
    for (const knob of KNOBS) {
      const value = TUNING_DEFAULTS[knob.key]
      expect(value, knob.key).toBeGreaterThanOrEqual(knob.min)
      expect(value, knob.key).toBeLessThanOrEqual(knob.max)
    }
  })
})

describe('setTuning', () => {
  it('clamps rather than rejecting, so a bad value is never a broken world', () => {
    setTuning({ nativePlantTarget: 99999 })
    expect(TUNING.nativePlantTarget).toBe(400)

    setTuning({ maxPlants: -50 })
    expect(TUNING.maxPlants).toBe(10)
  })

  it('falls back to the default for values that are not numbers', () => {
    setTuning({ plantSeedBatch: Number.NaN })
    expect(TUNING.plantSeedBatch).toBe(TUNING_DEFAULTS.plantSeedBatch)
  })

  it('rounds knobs that count things', () => {
    setTuning({ plantSeedInterval: 4.7 })
    expect(TUNING.plantSeedInterval).toBe(5)
  })

  it('keeps fractions for the knobs that are fractions', () => {
    setTuning({ breedCost: 0.73 })
    expect(TUNING.breedCost).toBeCloseTo(0.73)
  })

  it('ignores keys that are not knobs', () => {
    setTuning({ worldWidth: 10 } as unknown as Partial<typeof TUNING>)
    expect(changedKnobs()).toEqual([])
  })

  /**
   * The one relationship the panel is not allowed to break: if a meal more than
   * pays for a child, grazers breed on every full stomach and strip the world.
   */
  it('never lets a meal pay for a baby', () => {
    setTuning({ mealValue: 0.95, breedCost: 0.5 })
    expect(TUNING.mealValue).toBeLessThan(TUNING.breedCost)

    // Pulling the cost down has to drag the meal down with it, not leave the
    // pair inverted.
    setTuning({ breedCost: 0.2 })
    expect(TUNING.mealValue).toBeLessThan(TUNING.breedCost)
  })
})

describe('changedKnobs', () => {
  it('is empty on a fresh world and names only what moved', () => {
    expect(changedKnobs()).toEqual([])
    setTuning({ nativePlantTarget: 60 })
    expect(changedKnobs()).toEqual(['nativePlantTarget'])
    resetTuning()
    expect(changedKnobs()).toEqual([])
  })
})
