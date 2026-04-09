import { describe, expect, it } from 'vitest'

import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { Item } from '@/app/tap-tap-adventure/models/item'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Unknown Item',
    description: 'A mysterious item',
    quantity: 1,
    ...overrides,
  }
}

describe('itemPostProcessor', () => {
  describe('potions', () => {
    it('infers healing potion as consumable with strength effect', () => {
      const item = makeItem({ name: 'Healing Potion' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.strength).toBe(2)
    })

    it('infers strength potion', () => {
      const item = makeItem({ name: 'Potion of Strength' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.strength).toBe(3)
    })

    it('infers wisdom elixir', () => {
      const item = makeItem({ name: 'Elixir of Wisdom' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.intelligence).toBe(2)
    })

    it('infers luck tonic', () => {
      const item = makeItem({ name: 'Lucky Tonic' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.luck).toBe(2)
    })

    it('defaults unknown potion to strength+intelligence', () => {
      const item = makeItem({ name: 'Mysterious Potion' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.strength).toBe(1)
      expect(result.effects?.intelligence).toBe(1)
    })
  })

  describe('scrolls', () => {
    it('infers scroll as consumable with intelligence', () => {
      const item = makeItem({ name: 'Mysterious Scroll' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.intelligence).toBe(1)
    })

    it('infers knowledge tome with intelligence boost', () => {
      const item = makeItem({ name: 'Tome of Knowledge' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.intelligence).toBe(2)
    })
  })

  describe('food', () => {
    it('infers bread as consumable', () => {
      const item = makeItem({ name: 'Loaf of Bread' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.strength).toBe(1)
    })
  })

  describe('gems and coins', () => {
    it('infers ruby as high-value gold consumable', () => {
      const item = makeItem({ name: 'Ruby Gemstone' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.gold).toBe(50)
    })

    it('infers gold coin', () => {
      const item = makeItem({ name: 'Gold Coin' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.gold).toBe(15)
    })
  })

  describe('charms', () => {
    it('infers amulet as luck consumable', () => {
      const item = makeItem({ name: 'Ancient Amulet' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
      expect(result.effects?.luck).toBe(2)
    })
  })

  describe('already complete items', () => {
    it('does not modify items with type and effects', () => {
      const item = makeItem({
        name: 'Custom Potion',
        type: 'consumable',
        effects: { gold: 100 },
      })
      const result = inferItemTypeAndEffects(item)
      expect(result.effects?.gold).toBe(100)
      expect(result.effects?.strength).toBeUndefined()
    })
  })

  describe('unrecognized items', () => {
    it('leaves unrecognized items as misc', () => {
      const item = makeItem({ name: 'Wooden Plank' })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBeUndefined()
      expect(result.effects).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('handles items with effects but no type', () => {
      const item = makeItem({ name: 'Magic Thing', effects: { strength: 5 } })
      const result = inferItemTypeAndEffects(item)
      expect(result.type).toBe('consumable')
    })

    it('handles consumable type with no effects', () => {
      const item = makeItem({ name: 'Magic Thing', type: 'consumable' })
      const result = inferItemTypeAndEffects(item)
      expect(result.effects).toBeDefined()
    })
  })
})
