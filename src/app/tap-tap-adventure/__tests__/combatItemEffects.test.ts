import { describe, expect, it } from 'vitest'

import {
  applyCombatItemEffect,
  isUsableInCombat,
} from '@/app/tap-tap-adventure/lib/combatItemEffects'
import { CombatPlayerState } from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'

const basePlayerState: CombatPlayerState = {
  hp: 50,
  maxHp: 100,
  attack: 15,
  defense: 10,
  isDefending: false,
  activeBuffs: [],
}

describe('combatItemEffects', () => {
  describe('isUsableInCombat', () => {
    it('returns true for consumable with strength effect', () => {
      const item: Item = {
        id: '1',
        name: 'Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { strength: 2 },
      }
      expect(isUsableInCombat(item)).toBe(true)
    })

    it('returns true for consumable with luck effect', () => {
      const item: Item = {
        id: '1',
        name: 'Lucky Charm',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { luck: 1 },
      }
      expect(isUsableInCombat(item)).toBe(true)
    })

    it('returns true for consumable with heal effect', () => {
      const item: Item = {
        id: '1',
        name: 'Healing Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { heal: 15 },
      }
      expect(isUsableInCombat(item)).toBe(true)
    })

    it('returns false for consumable with only gold effect', () => {
      const item: Item = {
        id: '1',
        name: 'Gold Coin',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { gold: 10 },
      }
      expect(isUsableInCombat(item)).toBe(false)
    })

    it('returns false for non-consumable items', () => {
      const item: Item = {
        id: '1',
        name: 'Sword',
        description: 'test',
        quantity: 1,
        type: 'equipment',
        effects: { strength: 5 },
      }
      expect(isUsableInCombat(item)).toBe(false)
    })

    it('returns false for items without effects', () => {
      const item: Item = {
        id: '1',
        name: 'Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
      }
      expect(isUsableInCombat(item)).toBe(false)
    })

    it('returns true for consumable with charisma effect', () => {
      const item: Item = {
        id: '1',
        name: 'Charm Elixir',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { charisma: 2 },
      }
      expect(isUsableInCombat(item)).toBe(true)
    })
  })

  describe('applyCombatItemEffect', () => {
    it('heals HP from heal effect', () => {
      const item: Item = {
        id: '1',
        name: 'Healing Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { heal: 15 },
      }
      const { playerState, description } = applyCombatItemEffect(item, basePlayerState)
      expect(playerState.hp).toBe(65)
      expect(description).toContain('restored 15 HP')
    })

    it('does not heal past maxHp', () => {
      const fullHpState = { ...basePlayerState, hp: 95 }
      const item: Item = {
        id: '1',
        name: 'Healing Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { heal: 50 },
      }
      const { playerState } = applyCombatItemEffect(item, fullHpState)
      expect(playerState.hp).toBe(100)
    })

    it('adds attack buff from strength effect', () => {
      const item: Item = {
        id: '1',
        name: 'Strength Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { strength: 3 },
      }
      const { playerState, description } = applyCombatItemEffect(item, basePlayerState)
      expect(playerState.hp).toBe(50) // HP unchanged
      expect(playerState.activeBuffs).toHaveLength(1)
      expect(playerState.activeBuffs![0].stat).toBe('attack')
      expect(playerState.activeBuffs![0].value).toBe(6) // 3 * 2
      expect(description).toContain('+6 attack for 3 turns')
    })

    it('adds defense buff from intelligence effect', () => {
      const item: Item = {
        id: '1',
        name: 'Shield Scroll',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { intelligence: 3 },
      }
      const { playerState, description } = applyCombatItemEffect(item, basePlayerState)
      expect(playerState.activeBuffs).toHaveLength(1)
      expect(playerState.activeBuffs![0].stat).toBe('defense')
      expect(playerState.activeBuffs![0].value).toBe(6) // 3 * 2
      expect(playerState.activeBuffs![0].turnsRemaining).toBe(3)
      expect(description).toContain('+6 defense')
    })

    it('adds attack buff from luck effect', () => {
      const item: Item = {
        id: '1',
        name: 'Lucky Charm',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { luck: 2 },
      }
      const { playerState, description } = applyCombatItemEffect(item, basePlayerState)
      expect(playerState.activeBuffs).toHaveLength(1)
      expect(playerState.activeBuffs![0].stat).toBe('attack')
      expect(playerState.activeBuffs![0].value).toBe(4) // 2 * 2
      expect(description).toContain('+4 attack')
    })

    it('adds defense buff from charisma effect', () => {
      const item: Item = {
        id: '1',
        name: 'Charm Elixir',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { charisma: 3 },
      }
      const { playerState, description } = applyCombatItemEffect(item, basePlayerState)
      expect(playerState.activeBuffs).toHaveLength(1)
      expect(playerState.activeBuffs![0].stat).toBe('defense')
      expect(playerState.activeBuffs![0].value).toBe(6) // 3 * 2
      expect(playerState.activeBuffs![0].turnsRemaining).toBe(3)
      expect(description).toContain('+6 defense')
    })

    it('applies multiple effects simultaneously', () => {
      const item: Item = {
        id: '1',
        name: 'Super Potion',
        description: 'test',
        quantity: 1,
        type: 'consumable',
        effects: { heal: 10, strength: 2, intelligence: 1, luck: 1 },
      }
      const { playerState } = applyCombatItemEffect(item, basePlayerState)
      expect(playerState.hp).toBe(60) // healed 10
      expect(playerState.activeBuffs).toHaveLength(3) // strength attack + defense + luck attack buffs
    })
  })
})
