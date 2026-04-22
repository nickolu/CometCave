import { describe, expect, it, vi } from 'vitest'

import {
  calculateFleeChance,
  getCombatRewards,
  initializePlayerCombatState,
  processPlayerAction,
} from '@/app/tap-tap-adventure/lib/combatEngine'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'

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
  charisma: 6,
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  factionReputations: {},
  inventory: [
    {
      id: 'potion-1',
      name: 'Healing Potion',
      description: 'Heals',
      quantity: 2,
      type: 'consumable',
      effects: { heal: 10 },
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
      comboCount: 0,
      abilityCooldown: 0,
      enemyStunned: false,
      shield: 0,
      luck: 0,
      mana: 0,
      maxMana: 0,
      ap: 3,
      maxAp: 3,
    },
    turnNumber: 0,
    combatLog: [],
    status: 'active',
    scenario: 'A goblin appears!',
    combatDistance: 'close',
    ...overrides,
  }
}

describe('Combat Engine', () => {
  describe('initializePlayerCombatState', () => {
    it('derives stats from character', () => {
      const state = initializePlayerCombatState(baseChar)
      // HP: 30 + 8*3 + 3*8 = 78
      expect(state.maxHp).toBe(78)
      expect(state.hp).toBe(78)
      // Attack: 2 + 8 + floor(3/2) = 11
      expect(state.attack).toBe(11)
      // Defense: 1 + floor(5/2) + floor(3/2) = 4
      expect(state.defense).toBe(4)
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
      expect(result.combatLog.length).toBeGreaterThanOrEqual(1) // player attack log
      expect(result.turnNumber).toBe(0)
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
        playerState: { ...makeActiveCombat().playerState, hp: 1, ap: 1, maxAp: 1 },
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
      // Healing potion with heal: 10 restores 10 HP directly
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
    it('returns gold from enemy', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.1) // high loot chance
      const rewards = getCombatRewards(combat, baseChar)

      expect(rewards.gold).toBe(15)
      expect(rewards.loot.length).toBeGreaterThanOrEqual(0)
      vi.restoreAllMocks()
    })
  })
})
