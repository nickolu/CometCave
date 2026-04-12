import { describe, expect, it } from 'vitest'

import { FALLBACK_CLASSES } from '@/app/tap-tap-adventure/config/fallbackClasses'
import { SpellEffectTypeSchema, SpellElementSchema } from '@/app/tap-tap-adventure/models/spell'
import {
  COMBAT_STYLES,
  generateManaAndSlots,
  generateStartingAbility,
  generateStatDistribution,
  getElementForModifier,
  getSchoolForModifier,
  getStyleCategory,
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

describe('getStyleCategory', () => {
  it('maps martial styles to martial', () => {
    expect(getStyleCategory('martial')).toBe('martial')
    expect(getStyleCategory('berserker')).toBe('martial')
    expect(getStyleCategory('guardian')).toBe('martial')
  })

  it('maps arcane styles to arcane', () => {
    expect(getStyleCategory('arcane')).toBe('arcane')
    expect(getStyleCategory('elementalist')).toBe('arcane')
  })

  it('maps shadow styles to shadow', () => {
    expect(getStyleCategory('shadow')).toBe('shadow')
    expect(getStyleCategory('assassin')).toBe('shadow')
  })

  it('defaults to martial for unknown styles', () => {
    expect(getStyleCategory('unknown')).toBe('martial')
  })
})

describe('getElementForModifier', () => {
  it('maps fire to fire element', () => {
    expect(getElementForModifier('fire')).toBe('fire')
  })

  it('maps ice to ice element', () => {
    expect(getElementForModifier('ice')).toBe('ice')
  })

  it('maps storm to lightning element', () => {
    expect(getElementForModifier('storm')).toBe('lightning')
  })

  it('maps void to shadow element', () => {
    expect(getElementForModifier('void')).toBe('shadow')
  })

  it('returns none for unknown modifiers', () => {
    expect(getElementForModifier('unknown')).toBe('none')
  })

  it('returns a valid SpellElement for all known modifiers', () => {
    const validElements = SpellElementSchema.options
    for (const modifier of MODIFIERS) {
      const element = getElementForModifier(modifier)
      expect(validElements).toContain(element)
    }
  })
})

describe('generateStatDistribution', () => {
  it('always totals 18', () => {
    for (const style of COMBAT_STYLES) {
      const stats = generateStatDistribution(style)
      expect(stats.strength + stats.intelligence + stats.luck).toBe(18)
    }
  })

  it('keeps all stats between 3 and 10', () => {
    // Run multiple times for randomness coverage
    for (let i = 0; i < 50; i++) {
      for (const style of ['martial', 'arcane', 'divine', 'shadow']) {
        const stats = generateStatDistribution(style)
        expect(stats.strength).toBeGreaterThanOrEqual(3)
        expect(stats.strength).toBeLessThanOrEqual(10)
        expect(stats.intelligence).toBeGreaterThanOrEqual(3)
        expect(stats.intelligence).toBeLessThanOrEqual(10)
        expect(stats.luck).toBeGreaterThanOrEqual(3)
        expect(stats.luck).toBeLessThanOrEqual(10)
      }
    }
  })

  it('martial styles favor strength', () => {
    // Average over many runs
    let totalStr = 0
    const runs = 100
    for (let i = 0; i < runs; i++) {
      totalStr += generateStatDistribution('martial').strength
    }
    expect(totalStr / runs).toBeGreaterThan(6)
  })

  it('arcane styles favor intelligence', () => {
    let totalInt = 0
    const runs = 100
    for (let i = 0; i < runs; i++) {
      totalInt += generateStatDistribution('arcane').intelligence
    }
    expect(totalInt / runs).toBeGreaterThan(7)
  })
})

describe('generateManaAndSlots', () => {
  it('returns manaMultiplier between 0.5 and 1.5', () => {
    for (let i = 0; i < 50; i++) {
      for (const style of ['martial', 'arcane', 'divine', 'psionic']) {
        const { manaMultiplier } = generateManaAndSlots(style)
        expect(manaMultiplier).toBeGreaterThanOrEqual(0.5)
        expect(manaMultiplier).toBeLessThanOrEqual(1.5)
      }
    }
  })

  it('returns spellSlots between 2 and 6', () => {
    for (let i = 0; i < 50; i++) {
      for (const style of ['martial', 'arcane', 'divine', 'psionic']) {
        const { spellSlots } = generateManaAndSlots(style)
        expect(spellSlots).toBeGreaterThanOrEqual(2)
        expect(spellSlots).toBeLessThanOrEqual(6)
      }
    }
  })
})

describe('generateStartingAbility', () => {
  it('returns valid SpellEffect types', () => {
    const validTypes = SpellEffectTypeSchema.options
    for (const style of COMBAT_STYLES) {
      const ability = generateStartingAbility(style, 'fire', 'war')
      for (const effect of ability.effects) {
        expect(validTypes).toContain(effect.type)
      }
    }
  })

  it('returns 2+ effects', () => {
    for (const style of COMBAT_STYLES) {
      const ability = generateStartingAbility(style, 'ice', 'arcane')
      expect(ability.effects.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('uses the correct element from modifier', () => {
    const ability = generateStartingAbility('arcane', 'fire', 'war')
    const damageEffects = ability.effects.filter(e => e.element)
    if (damageEffects.length > 0) {
      expect(damageEffects[0].element).toBe('fire')
    }
  })

  it('has valid target', () => {
    for (const style of COMBAT_STYLES) {
      const ability = generateStartingAbility(style, 'fire', 'war')
      expect(['enemy', 'self']).toContain(ability.target)
    }
  })

  it('has manaCost and cooldown', () => {
    const ability = generateStartingAbility('martial', 'iron', 'war')
    expect(ability.manaCost).toBeGreaterThan(0)
    expect(ability.cooldown).toBeGreaterThan(0)
  })

  it('has tags', () => {
    const ability = generateStartingAbility('martial', 'iron', 'war')
    expect(ability.tags.length).toBeGreaterThan(0)
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

  it('all fallback class abilities use valid SpellEffect types', () => {
    const validTypes = SpellEffectTypeSchema.options
    for (const cls of FALLBACK_CLASSES) {
      for (const effect of cls.startingAbility.effects) {
        expect(validTypes).toContain(effect.type)
      }
    }
  })

  it('all fallback class abilities use valid SpellElement values', () => {
    const validElements = SpellElementSchema.options
    for (const cls of FALLBACK_CLASSES) {
      for (const effect of cls.startingAbility.effects) {
        if (effect.element) {
          expect(validElements).toContain(effect.element)
        }
      }
    }
  })
})
