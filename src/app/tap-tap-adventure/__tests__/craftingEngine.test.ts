import { describe, expect, it } from 'vitest'

import { CRAFTING_RECIPES } from '@/app/tap-tap-adventure/config/craftingRecipes'
import { canCraft, applyCraft } from '@/app/tap-tap-adventure/lib/craftingEngine'
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
  gold: 100,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 5,
  intelligence: 5,
  luck: 5,
  charisma: 6,
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

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${Math.random()}`,
    name: 'Test Item',
    description: 'A test item',
    quantity: 1,
    status: 'active',
    type: 'consumable',
    ...overrides,
  }
}

const healingSalve = CRAFTING_RECIPES.find(r => r.id === 'healing_salve')!
const reinforcedWeapon = CRAFTING_RECIPES.find(r => r.id === 'reinforced_weapon')!
const spellTome = CRAFTING_RECIPES.find(r => r.id === 'spell_tome')!
const survivalKit = CRAFTING_RECIPES.find(r => r.id === 'survival_kit')!

describe('canCraft', () => {
  it('returns false when inventory has 0 matching items', () => {
    const char = { ...baseChar, inventory: [] }
    expect(canCraft(healingSalve, char.inventory, char.gold)).toBe(false)
  })

  it('returns false when inventory has fewer items than required', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 1 })]
    expect(canCraft(healingSalve, inventory, 100)).toBe(false)
  })

  it('returns false when gold is less than goldCost', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 2 })]
    expect(canCraft(healingSalve, inventory, 10)).toBe(false)
  })

  it('returns true when item counts and gold are sufficient', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 2 })]
    expect(canCraft(healingSalve, inventory, 100)).toBe(true)
  })

  it('counts quantity across multiple separate items of same type', () => {
    const inventory = [
      makeItem({ id: 'a', type: 'consumable', quantity: 1 }),
      makeItem({ id: 'b', type: 'consumable', quantity: 1 }),
    ]
    expect(canCraft(healingSalve, inventory, 100)).toBe(true)
  })

  it('ignores deleted items', () => {
    const inventory = [
      makeItem({ id: 'a', type: 'consumable', quantity: 1, status: 'deleted' }),
      makeItem({ id: 'b', type: 'consumable', quantity: 1 }),
    ]
    // only 1 active consumable, needs 2
    expect(canCraft(healingSalve, inventory, 100)).toBe(false)
  })

  it('handles recipes requiring multiple ingredient types', () => {
    const inventory = [
      makeItem({ id: 'a', type: 'equipment', quantity: 1 }),
      makeItem({ id: 'b', type: 'misc', quantity: 1 }),
    ]
    expect(canCraft(reinforcedWeapon, inventory, 100)).toBe(true)
  })

  it('returns false when one ingredient type is missing for multi-type recipe', () => {
    const inventory = [makeItem({ type: 'equipment', quantity: 1 })]
    expect(canCraft(reinforcedWeapon, inventory, 100)).toBe(false)
  })

  it('handles spell_scroll type ingredients', () => {
    const inventory = [
      makeItem({ id: 'a', type: 'spell_scroll', quantity: 2 }),
    ]
    expect(canCraft(spellTome, inventory, 100)).toBe(true)
  })
})

describe('applyCraft', () => {
  it('deducts goldCost from character gold', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 2 })]
    const char = { ...baseChar, gold: 100, inventory }
    const result = applyCraft(char, healingSalve)
    expect(result.gold).toBe(100 - healingSalve.goldCost)
  })

  it('decrements quantity of consumed items from a single stack', () => {
    const item = makeItem({ id: 'pot', type: 'consumable', quantity: 3 })
    const char = { ...baseChar, inventory: [item] }
    // healing_salve needs 2 consumables
    const result = applyCraft(char, healingSalve)
    const remaining = result.inventory.find(i => i.id === 'pot')
    expect(remaining?.quantity).toBe(1)
    expect(remaining?.status).not.toBe('deleted')
  })

  it('soft-deletes items whose quantity reaches 0', () => {
    const item = makeItem({ id: 'pot', type: 'consumable', quantity: 2 })
    const char = { ...baseChar, inventory: [item] }
    const result = applyCraft(char, healingSalve)
    const consumed = result.inventory.find(i => i.id === 'pot')
    expect(consumed?.status).toBe('deleted')
    expect(consumed?.quantity).toBe(0)
  })

  it('consumes items across multiple stacks', () => {
    const item1 = makeItem({ id: 'a', type: 'consumable', quantity: 1 })
    const item2 = makeItem({ id: 'b', type: 'consumable', quantity: 1 })
    const char = { ...baseChar, inventory: [item1, item2] }
    const result = applyCraft(char, healingSalve)
    const remaining1 = result.inventory.find(i => i.id === 'a')
    const remaining2 = result.inventory.find(i => i.id === 'b')
    expect(remaining1?.status).toBe('deleted')
    expect(remaining2?.status).toBe('deleted')
  })

  it('adds the crafted item to inventory with correct properties', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 2 })]
    const char = { ...baseChar, inventory }
    const result = applyCraft(char, healingSalve)
    const crafted = result.inventory.find(i => i.name === healingSalve.result.name)
    expect(crafted).toBeDefined()
    expect(crafted?.type).toBe(healingSalve.result.type)
    expect(crafted?.effects).toEqual(healingSalve.result.effects)
    expect(crafted?.quantity).toBe(1)
    expect(crafted?.status).toBe('active')
  })

  it('crafted item id starts with crafted_ prefix', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 2 })]
    const char = { ...baseChar, inventory }
    const result = applyCraft(char, healingSalve)
    const crafted = result.inventory.find(i => i.name === healingSalve.result.name)
    expect(crafted?.id).toMatch(/^crafted_healing_salve_/)
  })

  it('handles recipes requiring 3 consumables (survival_kit)', () => {
    const inventory = [
      makeItem({ id: 'a', type: 'consumable', quantity: 2 }),
      makeItem({ id: 'b', type: 'consumable', quantity: 1 }),
    ]
    const char = { ...baseChar, gold: 100, inventory }
    const result = applyCraft(char, survivalKit)
    const crafted = result.inventory.find(i => i.name === survivalKit.result.name)
    expect(crafted).toBeDefined()
    expect(result.gold).toBe(100 - survivalKit.goldCost)
  })

  it('does not mutate the original character', () => {
    const inventory = [makeItem({ type: 'consumable', quantity: 2 })]
    const char = { ...baseChar, gold: 100, inventory }
    const originalGold = char.gold
    applyCraft(char, healingSalve)
    expect(char.gold).toBe(originalGold)
  })
})
