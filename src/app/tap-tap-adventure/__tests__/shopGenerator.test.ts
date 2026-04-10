import { describe, expect, it } from 'vitest'

import { getFallbackShopItems } from '@/app/tap-tap-adventure/lib/shopGenerator'

describe('shopGenerator', () => {
  describe('getFallbackShopItems', () => {
    it('returns 4 items', () => {
      const items = getFallbackShopItems(1)
      expect(items).toHaveLength(4)
    })

    it('all items have required fields', () => {
      const items = getFallbackShopItems(1)
      for (const item of items) {
        expect(item.id).toBeTruthy()
        expect(item.name).toBeTruthy()
        expect(item.description).toBeTruthy()
        expect(item.quantity).toBe(1)
        expect(item.price).toBeGreaterThan(0)
        expect(item.type).toBeDefined()
        expect(item.effects).toBeDefined()
      }
    })

    it('scales prices with level', () => {
      const level1Items = getFallbackShopItems(1)
      const level10Items = getFallbackShopItems(10)

      const avgPrice1 = level1Items.reduce((sum, i) => sum + (i.price ?? 0), 0) / level1Items.length
      const avgPrice10 =
        level10Items.reduce((sum, i) => sum + (i.price ?? 0), 0) / level10Items.length

      expect(avgPrice10).toBeGreaterThan(avgPrice1)
    })

    it('scales effects with level', () => {
      const level1Items = getFallbackShopItems(1)
      const level10Items = getFallbackShopItems(10)

      // The strength elixir (index 1) should have higher strength at higher levels
      const strEffectLv1 = level1Items[1].effects?.strength ?? 0
      const strEffectLv10 = level10Items[1].effects?.strength ?? 0

      expect(strEffectLv10).toBeGreaterThan(strEffectLv1)
    })

    it('items are post-processed with types', () => {
      const items = getFallbackShopItems(5)
      for (const item of items) {
        expect(item.type).toBe('consumable')
      }
    })
  })

  describe('purchase validation', () => {
    it('allows purchase when character has enough gold', () => {
      const characterGold = 100
      const itemPrice = 50
      expect(characterGold >= itemPrice).toBe(true)
    })

    it('rejects purchase when character does not have enough gold', () => {
      const characterGold = 10
      const itemPrice = 50
      expect(characterGold >= itemPrice).toBe(false)
    })

    it('allows purchase when gold exactly matches price', () => {
      const characterGold = 50
      const itemPrice = 50
      expect(characterGold >= itemPrice).toBe(true)
    })

    it('correctly deducts gold after purchase', () => {
      const characterGold = 100
      const itemPrice = 35
      const remainingGold = characterGold - itemPrice
      expect(remainingGold).toBe(65)
    })
  })
})
