import { describe, expect, it } from 'vitest'

import { generateItemDescription } from '@/app/tap-tap-adventure/lib/itemDescriptionGenerator'
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

describe('generateItemDescription', () => {
  it('generates description for consumable with heal effect', () => {
    const item = makeItem({
      type: 'consumable',
      effects: { heal: 10 },
    })
    expect(generateItemDescription(item)).toBe('Restores 10 HP')
  })

  it('generates description for consumable with multiple effects', () => {
    const item = makeItem({
      type: 'consumable',
      effects: { heal: 10, intelligence: 2 },
    })
    expect(generateItemDescription(item)).toBe('Restores 10 HP, +2 Intelligence')
  })

  it('generates description for equipment with strength', () => {
    const item = makeItem({
      type: 'equipment',
      effects: { strength: 3 },
    })
    expect(generateItemDescription(item)).toBe('+3 Strength when equipped')
  })

  it('keeps original description when item has no effects', () => {
    const item = makeItem({
      description: 'A mysterious artifact',
    })
    expect(generateItemDescription(item)).toBe('A mysterious artifact')
  })

  it('keeps original description when effects object is empty', () => {
    const item = makeItem({
      description: 'A mysterious artifact',
      effects: {},
    })
    expect(generateItemDescription(item)).toBe('A mysterious artifact')
  })

  it('generates description for item with gold effect', () => {
    const item = makeItem({
      type: 'consumable',
      effects: { gold: 50 },
    })
    expect(generateItemDescription(item)).toBe('+50 Gold')
  })

  it('generates description for equipment with multiple effects', () => {
    const item = makeItem({
      type: 'equipment',
      effects: { strength: 2, luck: 1 },
    })
    expect(generateItemDescription(item)).toBe('+2 Strength, +1 Luck when equipped')
  })
})
