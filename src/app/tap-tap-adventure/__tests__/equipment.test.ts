import { describe, expect, it } from 'vitest'

import { initializePlayerCombatState } from '@/app/tap-tap-adventure/lib/combatEngine'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { getEquipmentSlot } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/item'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Test Item',
    description: 'A test item',
    quantity: 1,
    ...overrides,
  }
}

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 3,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 8,
  intelligence: 5,
  luck: 6,
  inventory: [],
  deathCount: 0,
  equipment: { weapon: null, armor: null, accessory: null },
}

describe('getEquipmentSlot', () => {
  it('identifies weapons by keyword', () => {
    expect(getEquipmentSlot(makeItem({ name: 'Iron Sword' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'Battle Axe' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'Rusty Dagger' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'Longbow' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'Wooden Staff' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'Steel Blade' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'War Hammer' }))).toBe('weapon')
    expect(getEquipmentSlot(makeItem({ name: 'Silver Spear' }))).toBe('weapon')
  })

  it('identifies armor by keyword', () => {
    expect(getEquipmentSlot(makeItem({ name: 'Iron Armor' }))).toBe('armor')
    expect(getEquipmentSlot(makeItem({ name: 'Wooden Shield' }))).toBe('armor')
    expect(getEquipmentSlot(makeItem({ name: 'Steel Helm' }))).toBe('armor')
    expect(getEquipmentSlot(makeItem({ name: 'Leather Boots' }))).toBe('armor')
    expect(getEquipmentSlot(makeItem({ name: 'Mystic Cloak' }))).toBe('armor')
    expect(getEquipmentSlot(makeItem({ name: 'Wizard Robe' }))).toBe('armor')
    expect(getEquipmentSlot(makeItem({ name: 'Chain Mail' }))).toBe('armor')
  })

  it('identifies accessories by keyword', () => {
    expect(getEquipmentSlot(makeItem({ name: 'Gold Ring' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Ancient Amulet' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Lucky Charm' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Silver Necklace' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Jade Bracelet' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Magic Trinket' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Ruby Pendant' }))).toBe('accessory')
  })

  it('defaults to accessory for unknown items', () => {
    expect(getEquipmentSlot(makeItem({ name: 'Mystery Orb' }))).toBe('accessory')
    expect(getEquipmentSlot(makeItem({ name: 'Glowing Stone' }))).toBe('accessory')
  })
})

describe('Equipment effects in combat', () => {
  it('adds weapon bonus to attack', () => {
    const charWithWeapon: FantasyCharacter = {
      ...baseChar,
      equipment: {
        weapon: makeItem({ name: 'Iron Sword', type: 'equipment', effects: { strength: 3 } }),
        armor: null,
        accessory: null,
      },
    }
    const withWeapon = initializePlayerCombatState(charWithWeapon)
    const without = initializePlayerCombatState(baseChar)

    // Weapon adds strength * 2 to attack
    expect(withWeapon.attack).toBe(without.attack + 3 * 2)
  })

  it('adds armor bonus to defense', () => {
    const charWithArmor: FantasyCharacter = {
      ...baseChar,
      equipment: {
        weapon: null,
        armor: makeItem({ name: 'Iron Armor', type: 'equipment', effects: { intelligence: 2 } }),
        accessory: null,
      },
    }
    const withArmor = initializePlayerCombatState(charWithArmor)
    const without = initializePlayerCombatState(baseChar)

    expect(withArmor.defense).toBe(without.defense + 2)
  })

  it('adds accessory luck as a passive buff', () => {
    const charWithAccessory: FantasyCharacter = {
      ...baseChar,
      equipment: {
        weapon: null,
        armor: null,
        accessory: makeItem({ name: 'Lucky Charm', type: 'equipment', effects: { luck: 2 } }),
      },
    }
    const withAccessory = initializePlayerCombatState(charWithAccessory)
    const without = initializePlayerCombatState(baseChar)

    // Accessory adds a passive buff
    expect(withAccessory.activeBuffs.length).toBe(1)
    expect(withAccessory.activeBuffs[0].stat).toBe('attack')
    expect(withAccessory.activeBuffs[0].value).toBe(2)
    expect(withAccessory.activeBuffs[0].turnsRemaining).toBe(999)

    // Without accessory, no buffs
    expect(without.activeBuffs.length).toBe(0)
  })

  it('handles no equipment gracefully', () => {
    const charNoEquipment: FantasyCharacter = {
      ...baseChar,
      equipment: undefined,
    }
    const state = initializePlayerCombatState(charNoEquipment)
    expect(state.attack).toBe(5 + baseChar.strength * 2 + baseChar.level)
    expect(state.defense).toBe(3 + baseChar.intelligence + baseChar.level)
  })

  it('combines all equipment bonuses', () => {
    const fullEquipChar: FantasyCharacter = {
      ...baseChar,
      equipment: {
        weapon: makeItem({ name: 'Steel Sword', type: 'equipment', effects: { strength: 2 } }),
        armor: makeItem({ name: 'Iron Armor', type: 'equipment', effects: { intelligence: 3 } }),
        accessory: makeItem({ name: 'Lucky Ring', type: 'equipment', effects: { luck: 1 } }),
      },
    }
    const state = initializePlayerCombatState(fullEquipChar)
    const base = initializePlayerCombatState(baseChar)

    expect(state.attack).toBe(base.attack + 2 * 2) // weapon strength * 2
    expect(state.defense).toBe(base.defense + 3) // armor intelligence
    expect(state.activeBuffs.length).toBe(1) // accessory luck buff
  })
})

describe('Item post-processor equipment inference', () => {
  it('infers weapon type for sword items', () => {
    const result = inferItemTypeAndEffects(makeItem({ name: 'Iron Sword' }))
    expect(result.type).toBe('equipment')
    expect(result.effects?.strength).toBeGreaterThan(0)
  })

  it('infers armor type for armor items', () => {
    const result = inferItemTypeAndEffects(makeItem({ name: 'Steel Armor' }))
    expect(result.type).toBe('equipment')
    expect(result.effects?.intelligence).toBeGreaterThan(0)
  })

  it('infers accessory type for ring items', () => {
    const result = inferItemTypeAndEffects(makeItem({ name: 'Gold Ring' }))
    expect(result.type).toBe('equipment')
    expect(result.effects?.luck).toBeGreaterThan(0)
  })

  it('gives higher stats for quality keywords', () => {
    const basic = inferItemTypeAndEffects(makeItem({ name: 'Sword' }))
    const steel = inferItemTypeAndEffects(makeItem({ name: 'Steel Sword' }))
    const legendary = inferItemTypeAndEffects(makeItem({ name: 'Legendary Sword' }))

    expect(basic.effects?.strength).toBe(1)
    expect(steel.effects?.strength).toBe(2)
    expect(legendary.effects?.strength).toBe(3)
  })

  it('does not override existing effects', () => {
    const result = inferItemTypeAndEffects(
      makeItem({ name: 'Iron Sword', effects: { strength: 5 } })
    )
    expect(result.effects?.strength).toBe(5)
  })

  it('preserves consumable type for potions', () => {
    const result = inferItemTypeAndEffects(makeItem({ name: 'Healing Potion' }))
    expect(result.type).toBe('consumable')
  })
})
