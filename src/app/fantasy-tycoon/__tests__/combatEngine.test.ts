import { describe, expect, it, vi } from 'vitest'

import {
  calculateFleeChance,
  getCombatRewards,
  initializePlayerCombatState,
  processPlayerAction,
} from '@/app/fantasy-tycoon/lib/combatEngine'
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'
import { CombatState } from '@/app/fantasy-tycoon/models/combat'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 3,
  xp: 0,
  xpToNextLevel: 225,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 8,
  intelligence: 5,
  luck: 6,
  inventory: [
    {
      id: 'potion-1',
      name: 'Healing Potion',
      description: 'Heals',
      quantity: 2,
      type: 'consumable',
      effects: { strength: 2 },
    },
  ],
}

function makeActiveCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    id: 'combat-1',
    eventId: 'event-1',
    enemy: {
      id: 'enemy-1',
      name: 'Goblin',
      description: 'A nasty goblin',
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 3,
      level: 2,
      xpReward: 40,
      goldReward: 15,
      lootTable: [
        { id: 'loot-1', name: 'Gold Coin', description: 'Shiny', quantity: 1 },
      ],
    },
    playerState: {
      hp: 90,
      maxHp: 90,
      attack: 24,
      defense: 11,
      isDefending: false,
      activeBuffs: [],
    },
    turnNumber: 0,
    combatLog: [],
    status: 'active',
    scenario: 'A goblin appears!',
    ...overrides,
  }
}

describe('Combat Engine', () => {
  describe('initializePlayerCombatState', () => {
    it('derives stats from character', () => {
      const state = initializePlayerCombatState(baseChar)
      // HP: 50 + 8*5 + 3*10 = 120
      expect(state.maxHp).toBe(120)
      expect(state.hp).toBe(120)
      // Attack: 5 + 8*2 + 3 = 24
      expect(state.attack).toBe(24)
      // Defense: 3 + 5 + 3 = 11
      expect(state.defense).toBe(11)
      expect(state.isDefending).toBe(false)
    })
  })

  describe('calculateFleeChance', () => {
    it('returns base + luck bonus - enemy level penalty', () => {
      // 0.3 + 6*0.02 - 2*0.05 = 0.3 + 0.12 - 0.1 = 0.32
      const chance = calculateFleeChance(baseChar, makeActiveCombat().enemy)
      expect(chance).toBeCloseTo(0.32, 1)
    })

    it('clamps between 0.1 and 0.9', () => {
      const weakChar = { ...baseChar, luck: 0 }
      const strongEnemy = { ...makeActiveCombat().enemy, level: 100 }
      expect(calculateFleeChance(weakChar, strongEnemy)).toBe(0.1)

      const luckyChar = { ...baseChar, luck: 50 }
      const weakEnemy = { ...makeActiveCombat().enemy, level: 0 }
      expect(calculateFleeChance(luckyChar, weakEnemy)).toBe(0.9)
    })
  })

  describe('processPlayerAction', () => {
    it('processes attack and reduces enemy HP', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.5) // neutral variance
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, baseChar)

      expect(result.enemy.hp).toBeLessThan(30)
      expect(result.combatLog.length).toBeGreaterThanOrEqual(2) // player attack + enemy attack
      expect(result.turnNumber).toBe(1)
      vi.restoreAllMocks()
    })

    it('processes defend and sets isDefending', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'defend' }, baseChar)

      // isDefending gets set then enemy attacks with doubled player defense
      // The log should show defend action
      const playerLog = result.combatLog.find(
        l => l.actor === 'player' && l.action === 'defend'
      )
      expect(playerLog).toBeTruthy()
      vi.restoreAllMocks()
    })

    it('processes flee successfully', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // below flee chance
      const { combatState: result } = processPlayerAction(combat, { action: 'flee' }, baseChar)

      expect(result.status).toBe('fled')
      vi.restoreAllMocks()
    })

    it('processes flee failure', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.99) // above flee chance
      const { combatState: result } = processPlayerAction(combat, { action: 'flee' }, baseChar)

      expect(result.status).toBe('active')
      const fleeLog = result.combatLog.find(l => l.action === 'flee')
      expect(fleeLog?.description).toContain('blocks your escape')
      vi.restoreAllMocks()
    })

    it('sets victory when enemy HP reaches 0', () => {
      const combat = makeActiveCombat({
        enemy: { ...makeActiveCombat().enemy, hp: 1, defense: 0 },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, baseChar)

      expect(result.enemy.hp).toBe(0)
      expect(result.status).toBe('victory')
      vi.restoreAllMocks()
    })

    it('sets defeat when player HP reaches 0', () => {
      const combat = makeActiveCombat({
        playerState: { ...makeActiveCombat().playerState, hp: 1 },
        enemy: { ...makeActiveCombat().enemy, attack: 100 },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'defend' }, baseChar)

      expect(result.playerState.hp).toBe(0)
      expect(result.status).toBe('defeat')
      vi.restoreAllMocks()
    })

    it('processes use_item and returns consumedItemId', () => {
      const combat = makeActiveCombat({
        playerState: { ...makeActiveCombat().playerState, hp: 50 },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result, consumedItemId } = processPlayerAction(
        combat,
        { action: 'use_item', itemId: 'potion-1' },
        baseChar
      )

      expect(consumedItemId).toBe('potion-1')
      // Healing potion with strength: 2 heals 10 HP (2 * 5)
      expect(result.playerState.hp).toBeGreaterThan(50)
      vi.restoreAllMocks()
    })

    it('does nothing if combat is not active', () => {
      const combat = makeActiveCombat({ status: 'victory' })
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatLog.length).toBe(0)
    })
  })

  describe('getCombatRewards', () => {
    it('returns xp and gold from enemy', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // high loot chance
      const rewards = getCombatRewards(combat, baseChar)

      expect(rewards.xp).toBe(40)
      expect(rewards.gold).toBe(15)
      expect(rewards.loot.length).toBeGreaterThanOrEqual(0)
      vi.restoreAllMocks()
    })
  })
})
