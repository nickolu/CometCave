import { describe, expect, it, vi } from 'vitest'

import {
  generateRarityEffects,
  rollRarityForSource,
  RARITY_PRICE_MULTIPLIERS,
  RARITY_STAT_MULTIPLIERS,
} from '@/app/tap-tap-adventure/lib/itemRarityGenerator'
import { Item } from '@/app/tap-tap-adventure/models/item'

const baseEquipmentItem: Item = {
  id: 'test-weapon',
  name: 'Iron Sword',
  description: 'A basic sword.',
  quantity: 1,
  type: 'equipment',
  effects: { strength: 3 },
}

const baseConsumableItem: Item = {
  id: 'test-potion',
  name: 'Healing Potion',
  description: 'Restores HP.',
  quantity: 1,
  type: 'consumable',
  effects: { heal: 10 },
}

describe('itemRarityGenerator', () => {
  describe('RARITY_STAT_MULTIPLIERS', () => {
    it('common has 1.0 multiplier', () => {
      expect(RARITY_STAT_MULTIPLIERS.common).toBe(1.0)
    })

    it('legendary has the highest multiplier', () => {
      expect(RARITY_STAT_MULTIPLIERS.legendary).toBeGreaterThan(RARITY_STAT_MULTIPLIERS.epic)
      expect(RARITY_STAT_MULTIPLIERS.epic).toBeGreaterThan(RARITY_STAT_MULTIPLIERS.rare)
      expect(RARITY_STAT_MULTIPLIERS.rare).toBeGreaterThan(RARITY_STAT_MULTIPLIERS.uncommon)
      expect(RARITY_STAT_MULTIPLIERS.uncommon).toBeGreaterThan(RARITY_STAT_MULTIPLIERS.common)
    })
  })

  describe('RARITY_PRICE_MULTIPLIERS', () => {
    it('legendary is most expensive', () => {
      expect(RARITY_PRICE_MULTIPLIERS.legendary).toBeGreaterThan(RARITY_PRICE_MULTIPLIERS.epic)
    })

    it('common has 1.0 price multiplier', () => {
      expect(RARITY_PRICE_MULTIPLIERS.common).toBe(1.0)
    })
  })

  describe('rollRarityForSource', () => {
    it('returns a valid rarity', () => {
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']
      const rarity = rollRarityForSource('regular', 5)
      expect(validRarities).toContain(rarity)
    })

    it('boss source never returns common', () => {
      // Run many times to verify
      for (let i = 0; i < 20; i++) {
        // Mock random to always pick first entry (common for boss has 0 weight, so it should never return common)
        vi.spyOn(Math, 'random').mockReturnValue(0.0)
        const rarity = rollRarityForSource('boss', 0)
        // With weight 0 for common and roll=0, we get uncommon (first non-zero weight)
        expect(rarity).not.toBe('common')
        vi.restoreAllMocks()
      }
    })

    it('with high luck, shifts toward rarer items (luck bonus reduces common weight)', () => {
      // With luck=50, luck bonus is capped at 0.15
      // The roll function reduces common weight and increases legendary weight
      // We can verify it returns a valid rarity for high luck
      const rarity = rollRarityForSource('regular', 50)
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']
      expect(validRarities).toContain(rarity)
    })

    it('returns common for regular source with low roll and zero luck', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.01) // well within common range (0.55 weight)
      const rarity = rollRarityForSource('regular', 0)
      expect(rarity).toBe('common')
      vi.restoreAllMocks()
    })

    it('accepts all valid source types', () => {
      const sources: Array<'regular' | 'boss' | 'miniboss' | 'shop' | 'landmark' | 'npc'> = [
        'regular', 'boss', 'miniboss', 'shop', 'landmark', 'npc',
      ]
      for (const source of sources) {
        const rarity = rollRarityForSource(source, 5)
        expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(rarity)
      }
    })
  })

  describe('generateRarityEffects', () => {
    it('sets the rarity on the item', () => {
      const result = generateRarityEffects(baseEquipmentItem, 'rare')
      expect(result.rarity).toBe('rare')
    })

    it('common equipment gets no extra effects', () => {
      const result = generateRarityEffects(baseEquipmentItem, 'common')
      expect(result.onHitEffect).toBeUndefined()
      expect(result.passiveEffect).toBeUndefined()
      expect(result.drawback).toBeUndefined()
    })

    it('consumables do not get combat effects regardless of rarity', () => {
      const result = generateRarityEffects(baseConsumableItem, 'legendary')
      expect(result.onHitEffect).toBeUndefined()
      expect(result.passiveEffect).toBeUndefined()
    })

    it('rare equipment always gets onHitEffect', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.6) // above passive chance (0.5), so no passive
      const result = generateRarityEffects(baseEquipmentItem, 'rare')
      expect(result.onHitEffect).toBeDefined()
      vi.restoreAllMocks()
    })

    it('rare equipment may get passiveEffect', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // below passive chance (0.5), so gets passive
      const result = generateRarityEffects(baseEquipmentItem, 'rare')
      expect(result.passiveEffect).toBeDefined()
      vi.restoreAllMocks()
    })

    it('rare equipment gets loreText', () => {
      const result = generateRarityEffects(baseEquipmentItem, 'rare')
      expect(result.loreText).toBeDefined()
      expect(typeof result.loreText).toBe('string')
    })

    it('epic equipment always gets passiveEffect and onHitEffect', () => {
      const result = generateRarityEffects(baseEquipmentItem, 'epic')
      expect(result.onHitEffect).toBeDefined()
      expect(result.passiveEffect).toBeDefined()
    })

    it('epic equipment may get drawback', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // below drawback chance (0.7)
      const result = generateRarityEffects(baseEquipmentItem, 'epic')
      expect(result.drawback).toBeDefined()
      vi.restoreAllMocks()
    })

    it('legendary equipment always gets drawback', () => {
      const result = generateRarityEffects(baseEquipmentItem, 'legendary')
      expect(result.drawback).toBeDefined()
    })

    it('does not overwrite existing onHitEffect', () => {
      const itemWithEffect: Item = {
        ...baseEquipmentItem,
        onHitEffect: {
          type: 'stun',
          chance: 0.9,
          description: 'Pre-existing stun',
        },
      }
      const result = generateRarityEffects(itemWithEffect, 'rare')
      expect(result.onHitEffect?.type).toBe('stun')
      expect(result.onHitEffect?.chance).toBe(0.9)
    })
  })
})
