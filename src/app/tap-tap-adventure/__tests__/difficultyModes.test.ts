import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_MODES,
  getDifficultyMode,
  getDifficultyModifiers,
} from '@/app/tap-tap-adventure/config/difficultyModes'

describe('difficultyModes', () => {
  describe('DIFFICULTY_MODES', () => {
    it('should define exactly 4 modes', () => {
      expect(DIFFICULTY_MODES).toHaveLength(4)
    })

    it('should have unique ids', () => {
      const ids = DIFFICULTY_MODES.map(m => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('should include normal, hard, ironman, and casual', () => {
      const ids = DIFFICULTY_MODES.map(m => m.id)
      expect(ids).toContain('normal')
      expect(ids).toContain('hard')
      expect(ids).toContain('ironman')
      expect(ids).toContain('casual')
    })
  })

  describe('Normal mode modifiers', () => {
    const mods = getDifficultyModifiers('normal')

    it('should have 1x enemy HP multiplier', () => {
      expect(mods.enemyHpMultiplier).toBe(1)
    })

    it('should have 1x enemy attack multiplier', () => {
      expect(mods.enemyAttackMultiplier).toBe(1)
    })

    it('should have 1x gold multiplier', () => {
      expect(mods.goldMultiplier).toBe(1)
    })

    it('should have 1x heal rate multiplier', () => {
      expect(mods.healRateMultiplier).toBe(1)
    })

    it('should not have permadeath', () => {
      expect(mods.permadeath).toBe(false)
    })

    it('should have 1x loot chance multiplier', () => {
      expect(mods.lootChanceMultiplier).toBe(1)
    })
  })

  describe('Hard mode modifiers', () => {
    const mods = getDifficultyModifiers('hard')

    it('should have 1.5x enemy HP multiplier', () => {
      expect(mods.enemyHpMultiplier).toBe(1.5)
    })

    it('should have 1.5x enemy attack multiplier', () => {
      expect(mods.enemyAttackMultiplier).toBe(1.5)
    })

    it('should have 1.25x gold multiplier (reward for harder fights)', () => {
      expect(mods.goldMultiplier).toBe(1.25)
    })

    it('should have 1.25x loot chance multiplier', () => {
      expect(mods.lootChanceMultiplier).toBe(1.25)
    })

    it('should not have permadeath', () => {
      expect(mods.permadeath).toBe(false)
    })
  })

  describe('Ironman mode modifiers', () => {
    const mods = getDifficultyModifiers('ironman')

    it('should have 1x enemy HP multiplier', () => {
      expect(mods.enemyHpMultiplier).toBe(1)
    })

    it('should have 1x enemy attack multiplier', () => {
      expect(mods.enemyAttackMultiplier).toBe(1)
    })

    it('should have permadeath enabled', () => {
      expect(mods.permadeath).toBe(true)
    })
  })

  describe('Casual mode modifiers', () => {
    const mods = getDifficultyModifiers('casual')

    it('should have 0.7x enemy HP multiplier', () => {
      expect(mods.enemyHpMultiplier).toBe(0.7)
    })

    it('should have 0.7x enemy attack multiplier', () => {
      expect(mods.enemyAttackMultiplier).toBe(0.7)
    })

    it('should have 1.5x gold multiplier', () => {
      expect(mods.goldMultiplier).toBe(1.5)
    })

    it('should have 2x heal rate multiplier', () => {
      expect(mods.healRateMultiplier).toBe(2)
    })

    it('should not have permadeath', () => {
      expect(mods.permadeath).toBe(false)
    })
  })

  describe('getDifficultyMode', () => {
    it('should return the correct mode by id', () => {
      const mode = getDifficultyMode('hard')
      expect(mode.name).toBe('Hard')
    })

    it('should return Normal for unknown ids', () => {
      const mode = getDifficultyMode('unknown')
      expect(mode.id).toBe('normal')
    })
  })

  describe('getDifficultyModifiers', () => {
    it('should return Normal modifiers for undefined', () => {
      const mods = getDifficultyModifiers(undefined)
      expect(mods.enemyHpMultiplier).toBe(1)
      expect(mods.permadeath).toBe(false)
    })
  })

  describe('enemy stat scaling', () => {
    it('should scale enemy HP correctly for hard mode', () => {
      const mods = getDifficultyModifiers('hard')
      const baseHp = 100
      const scaledHp = Math.round(baseHp * mods.enemyHpMultiplier)
      expect(scaledHp).toBe(150)
    })

    it('should scale enemy HP correctly for casual mode', () => {
      const mods = getDifficultyModifiers('casual')
      const baseHp = 100
      const scaledHp = Math.round(baseHp * mods.enemyHpMultiplier)
      expect(scaledHp).toBe(70)
    })

    it('should scale enemy attack correctly for hard mode', () => {
      const mods = getDifficultyModifiers('hard')
      const baseAttack = 20
      const scaledAttack = Math.round(baseAttack * mods.enemyAttackMultiplier)
      expect(scaledAttack).toBe(30)
    })

    it('should not change enemy stats for normal mode', () => {
      const mods = getDifficultyModifiers('normal')
      const baseHp = 100
      const baseAttack = 20
      expect(Math.round(baseHp * mods.enemyHpMultiplier)).toBe(100)
      expect(Math.round(baseAttack * mods.enemyAttackMultiplier)).toBe(20)
    })
  })
})
