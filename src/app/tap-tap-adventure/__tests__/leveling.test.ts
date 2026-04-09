import { describe, expect, it } from 'vitest'

import {
  applyLevelFromDistance,
  calculateLevel,
  levelProgress,
  stepsRequiredForLevel,
  stepsToNextLevel,
} from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 1,
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

describe('Distance-Based Leveling', () => {
  describe('stepsToNextLevel', () => {
    it('returns 25 steps for level 1 -> 2', () => {
      // 20 + 1*5 = 25
      expect(stepsToNextLevel(1)).toBe(25)
    })

    it('returns 30 steps for level 2 -> 3', () => {
      // 20 + 2*5 = 30
      expect(stepsToNextLevel(2)).toBe(30)
    })

    it('increases with level', () => {
      expect(stepsToNextLevel(3)).toBe(35)
      expect(stepsToNextLevel(5)).toBe(45)
      expect(stepsToNextLevel(10)).toBe(70)
    })
  })

  describe('stepsRequiredForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(stepsRequiredForLevel(1)).toBe(0)
    })

    it('returns 25 for level 2', () => {
      expect(stepsRequiredForLevel(2)).toBe(25)
    })

    it('returns 55 for level 3', () => {
      // 25 + 30 = 55
      expect(stepsRequiredForLevel(3)).toBe(55)
    })

    it('returns 90 for level 4', () => {
      // 25 + 30 + 35 = 90
      expect(stepsRequiredForLevel(4)).toBe(90)
    })
  })

  describe('calculateLevel', () => {
    it('returns 1 at 0 distance', () => {
      expect(calculateLevel(0)).toBe(1)
    })

    it('returns 1 at 24 distance', () => {
      expect(calculateLevel(24)).toBe(1)
    })

    it('returns 2 at 25 distance', () => {
      expect(calculateLevel(25)).toBe(2)
    })

    it('returns 2 at 54 distance', () => {
      expect(calculateLevel(54)).toBe(2)
    })

    it('returns 3 at 55 distance', () => {
      expect(calculateLevel(55)).toBe(3)
    })

    it('returns 4 at 90 distance', () => {
      expect(calculateLevel(90)).toBe(4)
    })

    it('handles high distances', () => {
      expect(calculateLevel(500)).toBeGreaterThan(5)
    })
  })

  describe('levelProgress', () => {
    it('returns 0 at start of level', () => {
      expect(levelProgress(0)).toBe(0)
      expect(levelProgress(25)).toBe(0)
    })

    it('returns ~0.5 at midpoint', () => {
      // Level 1 needs 25 steps. At 12 steps: 12/25 ≈ 0.48
      expect(levelProgress(12)).toBeCloseTo(0.48, 1)
    })

    it('returns close to 1 near end of level', () => {
      // Level 1 needs 25 steps. At 24: 24/25 = 0.96
      expect(levelProgress(24)).toBeCloseTo(0.96, 1)
    })
  })

  describe('applyLevelFromDistance', () => {
    it('does not change character if level matches', () => {
      const char = { ...baseChar, distance: 10, level: 1 }
      const result = applyLevelFromDistance(char)
      expect(result).toBe(char) // same reference, no change
    })

    it('levels up and adds stats when distance crosses threshold', () => {
      const char = { ...baseChar, distance: 25, level: 1 }
      const result = applyLevelFromDistance(char)
      expect(result.level).toBe(2)
      expect(result.strength).toBe(6) // 5 + 1
      expect(result.intelligence).toBe(6)
      expect(result.luck).toBe(6)
    })

    it('handles multiple level jumps', () => {
      const char = { ...baseChar, distance: 55, level: 1 }
      const result = applyLevelFromDistance(char)
      expect(result.level).toBe(3)
      expect(result.strength).toBe(7) // 5 + 2
    })

    it('does not reduce stats if level somehow decreases', () => {
      const char = { ...baseChar, distance: 10, level: 3, strength: 10 }
      const result = applyLevelFromDistance(char)
      expect(result.level).toBe(1)
      expect(result.strength).toBe(10) // unchanged, no negative adjustment
    })
  })
})
