import { describe, expect, it } from 'vitest'

import {
  MAX_SITUATIONAL,
  MAX_SITUATIONAL_TOTAL,
  clampDc,
  clampSituational,
  difficultyLabel,
  resolveCheck,
  rollD20,
} from '@/app/dicebound/domain/dice'

/** A d20 that always shows `value`, for testing the parts that aren't chance. */
function fixed(value: number) {
  return () => (value - 1) / 20 + 0.001
}

describe('rollD20', () => {
  it('covers exactly 1..20 across the unit interval', () => {
    expect(rollD20(() => 0)).toBe(1)
    expect(rollD20(() => 0.9999)).toBe(20)
    expect(rollD20(() => 0.5)).toBe(11)
  })

  it('never falls outside the die over many rolls', () => {
    for (let i = 0; i < 2000; i++) {
      const roll = rollD20()
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })
})

describe('clampDc', () => {
  it('holds the table bounds', () => {
    expect(clampDc(-5)).toBe(0)
    expect(clampDc(99)).toBe(30)
    expect(clampDc(12)).toBe(12)
  })

  it('falls back to medium for nonsense, rather than throwing', () => {
    expect(clampDc(undefined)).toBe(10)
    expect(clampDc('hard')).toBe(10)
    expect(clampDc(Number.NaN)).toBe(10)
  })
})

describe('difficultyLabel', () => {
  it('names exact rows', () => {
    expect(difficultyLabel(0)).toBe('trivial')
    expect(difficultyLabel(15)).toBe('hard')
    expect(difficultyLabel(30)).toBe('impossible')
  })

  it('rounds an off-table number down to the row below it', () => {
    expect(difficultyLabel(13)).toBe('kinda hard')
    expect(difficultyLabel(22)).toBe('extremely difficult')
  })
})

describe('clampSituational', () => {
  it('drops zeroes and clamps each entry', () => {
    const out = clampSituational([
      { label: 'wet floor', value: -9 },
      { label: 'nothing', value: 0 },
      { label: 'rope', value: 9 },
    ])
    expect(out).toEqual([
      { label: 'wet floor', value: -MAX_SITUATIONAL },
      { label: 'rope', value: MAX_SITUATIONAL },
    ])
  })

  it('scales a stacked set back under the total ceiling', () => {
    const out = clampSituational([
      { label: 'a', value: 4 },
      { label: 'b', value: 4 },
      { label: 'c', value: 4 },
    ])
    const total = out.reduce((sum, m) => sum + m.value, 0)
    expect(Math.abs(total)).toBeLessThanOrEqual(MAX_SITUATIONAL_TOTAL)
  })

  it('keeps every reason visible when it scales', () => {
    const out = clampSituational([
      { label: 'a', value: 4 },
      { label: 'b', value: 4 },
      { label: 'c', value: 4 },
    ])
    // The player was told three things affected this roll; all three still show.
    expect(out).toHaveLength(3)
    expect(out.every(m => m.value !== 0)).toBe(true)
  })
})

describe('resolveCheck', () => {
  it('adds the modifiers and reports the margin', () => {
    const outcome = resolveCheck(
      {
        dc: 15,
        modifiers: [
          { label: 'Dexterity', value: 2 },
          { label: 'rope', value: 1 },
        ],
      },
      fixed(12)
    )
    expect(outcome.roll).toBe(12)
    expect(outcome.modifier).toBe(3)
    expect(outcome.total).toBe(15)
    expect(outcome.margin).toBe(0)
    expect(outcome.succeeded).toBe(true)
  })

  it('keeps zero-value modifiers so the card can show its work', () => {
    const outcome = resolveCheck({ dc: 10, modifiers: [{ label: 'Wisdom', value: 0 }] }, fixed(10))
    expect(outcome.modifiers).toHaveLength(1)
  })

  it('bands by how far over or under the line it landed', () => {
    const dc = 10
    const mods = [{ label: 'x', value: 0 }]
    expect(resolveCheck({ dc, modifiers: mods }, fixed(16)).band).toBe('strong-success')
    expect(resolveCheck({ dc, modifiers: mods }, fixed(12)).band).toBe('success')
    expect(resolveCheck({ dc, modifiers: mods }, fixed(8)).band).toBe('failure')
    expect(resolveCheck({ dc, modifiers: mods }, fixed(4)).band).toBe('strong-failure')
  })

  it('lets a natural 20 beat a DC the character cannot reach', () => {
    const outcome = resolveCheck(
      { dc: 30, modifiers: [{ label: 'Strength', value: -2 }] },
      fixed(20)
    )
    expect(outcome.band).toBe('critical-success')
    expect(outcome.succeeded).toBe(true)
    // Still honest about the arithmetic — the card shows a miss by 12.
    expect(outcome.margin).toBe(-12)
  })

  it('lets a natural 1 fail a DC the character cannot miss', () => {
    const outcome = resolveCheck({ dc: 2, modifiers: [{ label: 'Strength', value: 3 }] }, fixed(1))
    expect(outcome.band).toBe('critical-failure')
    expect(outcome.succeeded).toBe(false)
    expect(outcome.margin).toBe(2)
  })
})
