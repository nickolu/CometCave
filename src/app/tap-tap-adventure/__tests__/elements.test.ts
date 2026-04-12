import { describe, expect, it } from 'vitest'

import { getElementalMultiplier, getEffectivenessText } from '@/app/tap-tap-adventure/config/elements'
import { getClassElement } from '@/app/tap-tap-adventure/config/characterOptions'
import { SpellElement } from '@/app/tap-tap-adventure/models/spell'

describe('getElementalMultiplier', () => {
  describe('weakness matchups (2x)', () => {
    it('fire vs nature = 2x', () => {
      expect(getElementalMultiplier('fire', 'nature')).toBe(2.0)
    })

    it('ice vs fire = 2x', () => {
      expect(getElementalMultiplier('ice', 'fire')).toBe(2.0)
    })

    it('lightning vs ice = 2x', () => {
      expect(getElementalMultiplier('lightning', 'ice')).toBe(2.0)
    })

    it('shadow vs arcane = 2x', () => {
      expect(getElementalMultiplier('shadow', 'arcane')).toBe(2.0)
    })

    it('nature vs lightning = 2x', () => {
      expect(getElementalMultiplier('nature', 'lightning')).toBe(2.0)
    })

    it('nature vs shadow = 2x', () => {
      expect(getElementalMultiplier('nature', 'shadow')).toBe(2.0)
    })

    it('arcane vs shadow = 2x', () => {
      expect(getElementalMultiplier('arcane', 'shadow')).toBe(2.0)
    })
  })

  describe('resistance matchups (0.5x)', () => {
    it('fire vs ice = 0.5x', () => {
      expect(getElementalMultiplier('fire', 'ice')).toBe(0.5)
    })

    it('ice vs lightning = 0.5x', () => {
      expect(getElementalMultiplier('ice', 'lightning')).toBe(0.5)
    })

    it('lightning vs nature = 0.5x', () => {
      expect(getElementalMultiplier('lightning', 'nature')).toBe(0.5)
    })

    it('shadow vs nature = 0.5x', () => {
      expect(getElementalMultiplier('shadow', 'nature')).toBe(0.5)
    })

    it('nature vs fire = 0.5x', () => {
      expect(getElementalMultiplier('nature', 'fire')).toBe(0.5)
    })
  })

  describe('neutral matchups (1x)', () => {
    it('fire vs fire = 1x', () => {
      expect(getElementalMultiplier('fire', 'fire')).toBe(1.0)
    })

    it('fire vs lightning = 1x', () => {
      expect(getElementalMultiplier('fire', 'lightning')).toBe(1.0)
    })

    it('arcane vs fire = 1x (arcane resists nothing)', () => {
      expect(getElementalMultiplier('arcane', 'fire')).toBe(1.0)
    })

    it('none vs fire = 1x', () => {
      expect(getElementalMultiplier('none', 'fire')).toBe(1.0)
    })

    it('fire vs none = 1x', () => {
      expect(getElementalMultiplier('fire', 'none')).toBe(1.0)
    })

    it('none vs none = 1x', () => {
      expect(getElementalMultiplier('none', 'none')).toBe(1.0)
    })
  })

  describe('undefined/missing elements', () => {
    it('undefined attack = 1x', () => {
      expect(getElementalMultiplier(undefined, 'fire')).toBe(1.0)
    })

    it('undefined defense = 1x', () => {
      expect(getElementalMultiplier('fire', undefined)).toBe(1.0)
    })

    it('both undefined = 1x', () => {
      expect(getElementalMultiplier(undefined, undefined)).toBe(1.0)
    })
  })
})

describe('getEffectivenessText', () => {
  it('returns "Super effective!" for 2x', () => {
    expect(getEffectivenessText(2.0)).toBe('Super effective!')
  })

  it('returns "Resisted!" for 0.5x', () => {
    expect(getEffectivenessText(0.5)).toBe('Resisted!')
  })

  it('returns null for 1x', () => {
    expect(getEffectivenessText(1.0)).toBeNull()
  })
})

describe('getClassElement', () => {
  it('warrior = none', () => {
    expect(getClassElement('Warrior')).toBe('none')
  })

  it('mage = arcane', () => {
    expect(getClassElement('Mage')).toBe('arcane')
  })

  it('rogue = shadow', () => {
    expect(getClassElement('Rogue')).toBe('shadow')
  })

  it('ranger = nature', () => {
    expect(getClassElement('Ranger')).toBe('nature')
  })

  it('unknown class = none', () => {
    expect(getClassElement('Bard')).toBe('none')
  })

  it('generated class with fire modifier = fire', () => {
    const classData = {
      id: 'pyromancer',
      name: 'Pyromancer',
      description: 'A master of fire',
      combatStyle: 'ranged',
      modifier: 'fire',
      statDistribution: { strength: 4, intelligence: 8, luck: 5 },
      favoredSchool: 'arcane' as const,
      manaMultiplier: 1.2,
      spellSlots: 5,
      startingAbility: {
        name: 'Fireball',
        description: 'Throws a fireball',
        manaCost: 10,
        cooldown: 2,
        target: 'enemy' as const,
        effects: [],
        tags: [],
      },
    }
    expect(getClassElement('Pyromancer', classData)).toBe('fire')
  })

  it('generated class with frost modifier = ice', () => {
    const classData = {
      id: 'frost-mage',
      name: 'Frost Mage',
      description: 'A master of frost',
      combatStyle: 'ranged',
      modifier: 'frost',
      statDistribution: { strength: 4, intelligence: 8, luck: 5 },
      favoredSchool: 'arcane' as const,
      manaMultiplier: 1.2,
      spellSlots: 5,
      startingAbility: {
        name: 'Ice Shard',
        description: 'Launches ice',
        manaCost: 10,
        cooldown: 2,
        target: 'enemy' as const,
        effects: [],
        tags: [],
      },
    }
    expect(getClassElement('Frost Mage', classData)).toBe('ice')
  })

  it('generated class with unrecognized modifier falls back to class name', () => {
    const classData = {
      id: 'paladin',
      name: 'Paladin',
      description: 'A holy warrior',
      combatStyle: 'melee',
      modifier: 'holy',
      statDistribution: { strength: 7, intelligence: 5, luck: 5 },
      favoredSchool: 'war' as const,
      manaMultiplier: 0.8,
      spellSlots: 3,
      startingAbility: {
        name: 'Smite',
        description: 'Holy strike',
        manaCost: 8,
        cooldown: 3,
        target: 'enemy' as const,
        effects: [],
        tags: [],
      },
    }
    expect(getClassElement('Paladin', classData)).toBe('none')
  })
})
