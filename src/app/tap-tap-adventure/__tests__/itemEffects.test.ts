import { describe, expect, it } from 'vitest'

import { useItem } from '@/app/tap-tap-adventure/lib/itemEffects'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 1,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 5,
  intelligence: 5,
  luck: 5,
  charisma: 5,
  hp: 50,
  maxHp: 100,
  inventory: [],
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  factionReputations: {},
}

function makeConsumable(overrides: Partial<Item> = {}): Item {
  return {
    id: 'potion-1',
    name: 'Healing Potion',
    description: 'Restores health',
    quantity: 3,
    type: 'consumable',
    effects: { heal: 10, luck: 1 },
    ...overrides,
  }
}

describe('Item Effects', () => {
  it('applies stat effects from a consumable item', () => {
    const item = makeConsumable()
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(true)
    // Heal effect restores 10 HP directly
    expect(result.character.hp).toBe(60) // 50 + 10
    expect(result.character.luck).toBe(6) // 5 + 1
    expect(result.message).toContain('+10 HP')
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

  it('applies multiple effects simultaneously', () => {
    const item = makeConsumable({
      effects: { gold: 10, reputation: 5, heal: 15, strength: 1, intelligence: 2, luck: 3 },
    })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.gold).toBe(60)
    expect(result.character.reputation).toBe(15)
    expect(result.character.hp).toBe(65) // 50 + 15 heal
    expect(result.character.strength).toBe(6) // 5 + 1 strength
    expect(result.character.intelligence).toBe(7)
    expect(result.character.luck).toBe(8)
    expect(result.consumed).toBe(true)
  })

  it('strength effect adds to strength stat (not HP)', () => {
    const item = makeConsumable({ effects: { strength: 3 } })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.strength).toBe(8) // 5 + 3
    expect(result.character.hp).toBe(50) // unchanged
    expect(result.message).toContain('+3 Strength')
  })

  it('heal effect restores HP directly', () => {
    const item = makeConsumable({ effects: { heal: 20 } })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.hp).toBe(70) // 50 + 20
    expect(result.character.strength).toBe(5) // unchanged
    expect(result.message).toContain('+20 HP')
  })

  it('heal effect does not exceed maxHp', () => {
    const item = makeConsumable({ effects: { heal: 100 } })
    const char = { ...baseChar, hp: 90, inventory: [item] }
    const result = useItem(char, item)

    expect(result.character.hp).toBe(100) // capped at maxHp
    expect(result.message).toContain('+10 HP')
  })

  it('rejects deleted items', () => {
    const item = makeConsumable({ status: 'deleted' })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(false)
    expect(result.message).toContain('discarded')
  })

  it('applies charisma effect from consumable', () => {
    const item = makeConsumable({ effects: { charisma: 2 } })
    const char = { ...baseChar, inventory: [item] }
    const result = useItem(char, item)

    expect(result.consumed).toBe(true)
    expect(result.character.charisma).toBe(7) // 5 + 2
    expect(result.message).toContain('+2 Charisma')
  })
})
