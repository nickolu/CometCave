import { describe, it, expect } from 'vitest'

import { calculateSellPrice } from '@/app/tap-tap-adventure/lib/sellPrice'
import { Item } from '@/app/tap-tap-adventure/models/item'

describe('calculateSellPrice', () => {
  it('returns 50% of explicit price (rounded down)', () => {
    const item: Item = {
      id: '1',
      name: 'Magic Sword',
      description: 'A glowing blade',
      quantity: 1,
      type: 'equipment',
      price: 100,
      effects: { strength: 5 },
    }
    expect(calculateSellPrice(item)).toBe(50)
  })

  it('returns 50% of an odd price (floors)', () => {
    const item: Item = {
      id: '2',
      name: 'Dagger',
      description: 'Sharp',
      quantity: 1,
      type: 'equipment',
      price: 17,
    }
    expect(calculateSellPrice(item)).toBe(8)
  })

  it('calculates equipment price from effects when no price field', () => {
    const item: Item = {
      id: '3',
      name: 'Iron Shield',
      description: 'Sturdy',
      quantity: 1,
      type: 'equipment',
      effects: { strength: 3, intelligence: 2 },
    }
    // 10 + (3 + 2) * 5 = 35
    expect(calculateSellPrice(item)).toBe(35)
  })

  it('calculates consumable price from effects when no price field', () => {
    const item: Item = {
      id: '4',
      name: 'Health Potion',
      description: 'Heals you',
      quantity: 1,
      type: 'consumable',
      effects: { strength: 2, luck: 1 },
    }
    // 5 + (2 + 1) * 3 = 14
    expect(calculateSellPrice(item)).toBe(14)
  })

  it('returns fallback of 3 for items with no price, type, or effects', () => {
    const item: Item = {
      id: '5',
      name: 'Mysterious Rock',
      description: 'A plain rock',
      quantity: 1,
    }
    expect(calculateSellPrice(item)).toBe(3)
  })

  it('returns fallback of 3 for misc type with no price', () => {
    const item: Item = {
      id: '6',
      name: 'Old Key',
      description: 'Rusty',
      quantity: 1,
      type: 'misc',
    }
    expect(calculateSellPrice(item)).toBe(3)
  })

  it('uses price field even if effects exist', () => {
    const item: Item = {
      id: '7',
      name: 'Enchanted Amulet',
      description: 'Glowing',
      quantity: 1,
      type: 'equipment',
      price: 200,
      effects: { luck: 5, intelligence: 3 },
    }
    // 50% of 200 = 100, ignores effects-based calc
    expect(calculateSellPrice(item)).toBe(100)
  })

  it('handles consumable with no effects and no price', () => {
    const item: Item = {
      id: '8',
      name: 'Stale Bread',
      description: 'Barely edible',
      quantity: 1,
      type: 'consumable',
    }
    // 5 + 0 * 3 = 5
    expect(calculateSellPrice(item)).toBe(5)
  })
})
