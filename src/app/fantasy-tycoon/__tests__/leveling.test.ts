import { describe, expect, it } from 'vitest'

import {
  applyXpGain,
  calculateXpToNextLevel,
  getXpForDecision,
} from '@/app/fantasy-tycoon/lib/leveling'
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Elf',
  class: 'Mage',
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  abilities: [],
  locationId: 'loc1',
  gold: 10,
  reputation: 5,
  distance: 0,
  status: 'active',
  strength: 5,
  intelligence: 5,
  luck: 5,
  inventory: [],
}

describe('Leveling System', () => {
  describe('calculateXpToNextLevel', () => {
    it('returns 100 for level 1', () => {
      expect(calculateXpToNextLevel(1)).toBe(100)
    })

    it('scales with level', () => {
      expect(calculateXpToNextLevel(2)).toBe(150)
      expect(calculateXpToNextLevel(3)).toBe(225)
    })
  })

  describe('getXpForDecision', () => {
    it('returns base XP for failure', () => {
      expect(getXpForDecision('failure')).toBe(25)
    })

    it('returns base + bonus XP for success', () => {
      expect(getXpForDecision('success')).toBe(40)
    })
  })

  describe('applyXpGain', () => {
    it('adds XP without leveling up', () => {
      const result = applyXpGain(baseChar, 50)
      expect(result.character.xp).toBe(50)
      expect(result.character.level).toBe(1)
      expect(result.leveledUp).toBe(false)
      expect(result.levelsGained).toBe(0)
      expect(result.xpGained).toBe(50)
    })

    it('levels up when XP reaches threshold', () => {
      const result = applyXpGain(baseChar, 100)
      expect(result.character.level).toBe(2)
      expect(result.character.xp).toBe(0)
      expect(result.character.xpToNextLevel).toBe(150)
      expect(result.leveledUp).toBe(true)
      expect(result.levelsGained).toBe(1)
    })

    it('carries over surplus XP', () => {
      const result = applyXpGain(baseChar, 120)
      expect(result.character.level).toBe(2)
      expect(result.character.xp).toBe(20)
      expect(result.leveledUp).toBe(true)
    })

    it('handles multiple level-ups in one gain', () => {
      const result = applyXpGain(baseChar, 300)
      // 100 to level 2, 150 to level 3, 50 remaining
      expect(result.character.level).toBe(3)
      expect(result.character.xp).toBe(50)
      expect(result.character.xpToNextLevel).toBe(225)
      expect(result.levelsGained).toBe(2)
    })

    it('increases stats on level-up', () => {
      const result = applyXpGain(baseChar, 100)
      expect(result.character.strength).toBe(6)
      expect(result.character.intelligence).toBe(6)
      expect(result.character.luck).toBe(6)
    })

    it('increases stats proportional to levels gained', () => {
      const result = applyXpGain(baseChar, 300)
      // 2 levels gained = +2 to each stat
      expect(result.character.strength).toBe(7)
      expect(result.character.intelligence).toBe(7)
      expect(result.character.luck).toBe(7)
    })

    it('handles characters missing xp fields gracefully', () => {
      const charWithoutXp = { ...baseChar } as FantasyCharacter
      delete (charWithoutXp as Record<string, unknown>).xp
      delete (charWithoutXp as Record<string, unknown>).xpToNextLevel
      const result = applyXpGain(charWithoutXp, 50)
      expect(result.character.xp).toBe(50)
      expect(result.character.level).toBe(1)
    })
  })
})
