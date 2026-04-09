import { describe, expect, it } from 'vitest'

import { useItem } from '@/app/fantasy-tycoon/lib/itemEffects'
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'
import { Item } from '@/app/fantasy-tycoon/models/item'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 5,
  intelligence: 5,
  luck: 5,
  inventory: [],
}

function makeConsumable(overrides: Partial<Item> = {}): Item {
  return {
    id: 'potion-1',
    name: 'Healing Potion',
    description: 'Restores health',
    quantity: 3,
    type: 'consumable',
    effects: { strength: 2, luck: 1 },
    ...overrides,
  }
}

describe('Item Effects', () => {
  it('applies stat effects from a consumable item', () => {
    const item = makeConsumable()
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(true)
    expect(result.character.strength).toBe(7) // 5 + 2
    expect(result.character.luck).toBe(6) // 5 + 1
    expect(result.message).toContain('+2 Strength')
    expect(result.message).toContain('+1 Luck')
  })

  it('decrements item quantity after use', () => {
    const item = makeConsumable({ quantity: 3 })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    const updatedItem = result.character.inventory.find(i => i.id === item.id)
    expect(updatedItem?.quantity).toBe(2)
  })

  it('marks item as deleted when quantity reaches 0', () => {
    const item = makeConsumable({ quantity: 1 })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    const updatedItem = result.character.inventory.find(i => i.id === item.id)
    expect(updatedItem?.status).toBe('deleted')
    expect(updatedItem?.quantity).toBe(0)
  })

  it('rejects non-consumable items', () => {
    const item: Item = {
      id: 'sword-1',
      name: 'Iron Sword',
      description: 'A sturdy sword',
      quantity: 1,
      type: 'equipment',
    }
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(false)
    expect(result.message).toContain('cannot be used')
    expect(result.character.strength).toBe(5) // unchanged
  })

  it('rejects items without effects', () => {
    const item: Item = {
      id: 'misc-1',
      name: 'Shiny Rock',
      description: 'A rock',
      quantity: 1,
      type: 'consumable',
    }
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(false)
  })

  it('applies gold effects', () => {
    const item = makeConsumable({ effects: { gold: 25 } })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.gold).toBe(75)
    expect(result.message).toContain('+25 Gold')
  })

  it('applies XP effects and triggers leveling', () => {
    const item = makeConsumable({ effects: { xp: 100 } })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.level).toBe(2) // leveled up from XP
    expect(result.levelUpResult?.leveledUp).toBe(true)
    expect(result.message).toContain('+100 XP')
  })

  it('applies multiple effects simultaneously', () => {
    const item = makeConsumable({
      effects: { gold: 10, reputation: 5, strength: 1, intelligence: 2, luck: 3 },
    })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.gold).toBe(60)
    expect(result.character.reputation).toBe(15)
    expect(result.character.strength).toBe(6)
    expect(result.character.intelligence).toBe(7)
    expect(result.character.luck).toBe(8)
    expect(result.consumed).toBe(true)
  })

  it('rejects deleted items', () => {
    const item = makeConsumable({ status: 'deleted' })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(false)
    expect(result.message).toContain('discarded')
  })
})
