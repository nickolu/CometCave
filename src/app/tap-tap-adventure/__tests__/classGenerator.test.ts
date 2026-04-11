import { describe, expect, it } from 'vitest'

import { FALLBACK_CLASSES } from '@/app/tap-tap-adventure/config/fallbackClasses'
import {
  COMBAT_STYLES,
  getSchoolForModifier,
  MODIFIERS,
  pickRandomSeeds,
} from '@/app/tap-tap-adventure/lib/classGenerator'

describe('pickRandomSeeds', () => {
  it('returns the requested number of seed combos', () => {
    const seeds = pickRandomSeeds(4)
    expect(seeds).toHaveLength(4)
  })

  it('returns unique combos (no duplicates)', () => {
    const seeds = pickRandomSeeds(4)
    const keys = seeds.map(s => `${s.style}+${s.modifier}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(4)
  })

  it('returns combos with valid styles and modifiers', () => {
    const seeds = pickRandomSeeds(10)
    for (const seed of seeds) {
      expect(COMBAT_STYLES).toContain(seed.style)
      expect(MODIFIERS).toContain(seed.modifier)
    }
  })

  it('returns empty array when count is 0', () => {
    const seeds = pickRandomSeeds(0)
    expect(seeds).toHaveLength(0)
  })

  it('can return up to the maximum possible combos', () => {
    const maxCombos = COMBAT_STYLES.length * MODIFIERS.length
    const seeds = pickRandomSeeds(maxCombos)
    expect(seeds).toHaveLength(maxCombos)
    const keys = seeds.map(s => `${s.style}+${s.modifier}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(maxCombos)
  })
})

describe('getSchoolForModifier', () => {
  it('maps fire to war', () => {
    expect(getSchoolForModifier('fire')).toBe('war')
  })

  it('maps ice to arcane', () => {
    expect(getSchoolForModifier('ice')).toBe('arcane')
  })

  it('maps storm to arcane', () => {
    expect(getSchoolForModifier('storm')).toBe('arcane')
  })

  it('maps blood to shadow', () => {
    expect(getSchoolForModifier('blood')).toBe('shadow')
  })

  it('maps nature to nature', () => {
    expect(getSchoolForModifier('nature')).toBe('nature')
  })

  it('maps void to shadow', () => {
    expect(getSchoolForModifier('void')).toBe('shadow')
  })

  it('maps light to arcane', () => {
    expect(getSchoolForModifier('light')).toBe('arcane')
  })

  it('maps beast to nature', () => {
    expect(getSchoolForModifier('beast')).toBe('nature')
  })

  it('maps time to arcane', () => {
    expect(getSchoolForModifier('time')).toBe('arcane')
  })

  it('maps iron to war', () => {
    expect(getSchoolForModifier('iron')).toBe('war')
  })

  it('returns arcane for unknown modifiers', () => {
    expect(getSchoolForModifier('unknown')).toBe('arcane')
  })
})

describe('fallback classes', () => {
  it('has at least 15 fallback classes', () => {
    expect(FALLBACK_CLASSES.length).toBeGreaterThanOrEqual(15)
  })

  it('all fallback classes have stat totals of 18', () => {
    for (const cls of FALLBACK_CLASSES) {
      const total =
        cls.statDistribution.strength +
        cls.statDistribution.intelligence +
        cls.statDistribution.luck
      expect(total).toBe(18)
    }
  })

  it('all fallback classes have each stat between 3 and 10', () => {
    for (const cls of FALLBACK_CLASSES) {
      expect(cls.statDistribution.strength).toBeGreaterThanOrEqual(3)
      expect(cls.statDistribution.strength).toBeLessThanOrEqual(10)
      expect(cls.statDistribution.intelligence).toBeGreaterThanOrEqual(3)
      expect(cls.statDistribution.intelligence).toBeLessThanOrEqual(10)
      expect(cls.statDistribution.luck).toBeGreaterThanOrEqual(3)
      expect(cls.statDistribution.luck).toBeLessThanOrEqual(10)
    }
  })

  it('all fallback classes have starting abilities', () => {
    for (const cls of FALLBACK_CLASSES) {
      expect(cls.startingAbility).toBeDefined()
      expect(cls.startingAbility.name).toBeTruthy()
      expect(cls.startingAbility.description).toBeTruthy()
      expect(cls.startingAbility.effects.length).toBeGreaterThan(0)
      expect(cls.startingAbility.tags.length).toBeGreaterThan(0)
    }
  })

  it('all fallback classes have valid favored schools', () => {
    const validSchools = ['arcane', 'nature', 'shadow', 'war']
    for (const cls of FALLBACK_CLASSES) {
      expect(validSchools).toContain(cls.favoredSchool)
    }
  })

  it('all fallback classes have manaMultiplier between 0.5 and 1.5', () => {
    for (const cls of FALLBACK_CLASSES) {
      expect(cls.manaMultiplier).toBeGreaterThanOrEqual(0.5)
      expect(cls.manaMultiplier).toBeLessThanOrEqual(1.5)
    }
  })

  it('all fallback classes have spellSlots between 2 and 6', () => {
    for (const cls of FALLBACK_CLASSES) {
      expect(cls.spellSlots).toBeGreaterThanOrEqual(2)
      expect(cls.spellSlots).toBeLessThanOrEqual(6)
    }
  })

  it('all fallback classes have unique IDs', () => {
    const ids = FALLBACK_CLASSES.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
