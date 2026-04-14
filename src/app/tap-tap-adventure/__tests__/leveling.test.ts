import { describe, expect, it } from 'vitest'

import {
  applyLevelFromDistance,
  calculateDay,
  calculateLevel,
  crossedMilestone,
  levelProgress,
  stepsRequiredForLevel,
  stepsToNextLevel,
  SHOP_MILESTONE_INTERVAL,
  STEPS_PER_DAY,
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
  hp: 100,
  maxHp: 100,
  inventory: [],
  deathCount: 0,
  pendingStatPoints: 0,
}

describe('Distance-Based Leveling (rebalanced)', () => {
  describe('stepsToNextLevel', () => {
    it('returns 250 steps for level 1 -> 2', () => {
      // 200 + 1*50 = 250
      expect(stepsToNextLevel(1)).toBe(250)
    })

    it('returns 300 steps for level 2 -> 3', () => {
      // 200 + 2*50 = 300
      expect(stepsToNextLevel(2)).toBe(300)
    })
  })

  describe('stepsRequiredForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(stepsRequiredForLevel(1)).toBe(0)
    })

    it('returns 250 for level 2', () => {
      expect(stepsRequiredForLevel(2)).toBe(250)
    })

    it('returns 550 for level 3', () => {
      // 250 + 300 = 550
      expect(stepsRequiredForLevel(3)).toBe(550)
    })
  })

  describe('calculateLevel', () => {
    it('returns 1 at 0 distance', () => {
      expect(calculateLevel(0)).toBe(1)
    })

    it('returns 1 at 249 distance', () => {
      expect(calculateLevel(249)).toBe(1)
    })

    it('returns 2 at 250 distance', () => {
      expect(calculateLevel(250)).toBe(2)
    })

    it('returns 3 at 550 distance', () => {
      expect(calculateLevel(550)).toBe(3)
    })
  })

  describe('levelProgress', () => {
    it('returns 0 at start of level', () => {
      expect(levelProgress(0)).toBe(0)
    })

    it('returns ~0.5 at midpoint of level 1', () => {
      expect(levelProgress(125)).toBeCloseTo(0.5, 1)
    })
  })

  describe('calculateDay', () => {
    it('returns 1 at distance 0', () => {
      expect(calculateDay(0)).toBe(1)
    })

    it('returns 1 at distance 49', () => {
      expect(calculateDay(49)).toBe(1)
    })

    it('returns 2 at distance 50', () => {
      expect(calculateDay(50)).toBe(2)
    })

    it('returns 3 at distance 100', () => {
      expect(calculateDay(100)).toBe(3)
    })
  })

  describe('crossedMilestone', () => {
    it('detects shop milestone at 75', () => {
      expect(crossedMilestone(74, 75, SHOP_MILESTONE_INTERVAL)).toBe(true)
    })

    it('does not trigger between milestones', () => {
      expect(crossedMilestone(50, 51, SHOP_MILESTONE_INTERVAL)).toBe(false)
    })

    it('detects milestone at 500', () => {
      expect(crossedMilestone(499, 500, 500)).toBe(true)
    })
  })

  describe('constants', () => {
    it('has expected milestone values', () => {
      expect(STEPS_PER_DAY).toBe(50)
      expect(SHOP_MILESTONE_INTERVAL).toBe(75)
    })
  })

  describe('applyLevelFromDistance', () => {
    it('heals 1 HP every 10 steps using distance thresholds', () => {
      // Distance 10, stepped from 9: crosses 10-step boundary → heals
      const charCrossing = { ...baseChar, distance: 10, hp: 40, maxHp: 53 }
      const result1 = applyLevelFromDistance(charCrossing, 1)
      expect(result1.hp).toBe(41)

      // Distance 12, stepped from 11: no boundary → no heal
      const charNoCross = { ...baseChar, distance: 12, hp: 40, maxHp: 53 }
      const result2 = applyLevelFromDistance(charNoCross, 1)
      expect(result2.hp).toBe(40)
    })

    it('does not heal past maxHp', () => {
      const char = { ...baseChar, distance: 20, hp: 53, maxHp: 53 }
      const result = applyLevelFromDistance(char, 1)
      expect(result.hp).toBe(53)
    })

    it('fully heals HP and mana on level up', () => {
      // At distance 250, level goes from 1 to 2
      const char = { ...baseChar, distance: 250, level: 1, hp: 10, mana: 5 }
      const result = applyLevelFromDistance(char)
      expect(result.level).toBe(2)
      expect(result.pendingStatPoints).toBe(3)
      // Should be fully healed
      expect(result.hp).toBe(result.maxHp)
      expect(result.mana).toBe(result.maxMana)
    })
  })
})
