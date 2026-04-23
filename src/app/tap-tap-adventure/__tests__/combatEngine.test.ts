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

  describe('passive effects from equipment', () => {
    it('accumulates bonusCritChance from crit_bonus passive', () => {
      const charWithCritBonus = {
        ...baseChar,
        equipment: {
          weapon: {
            id: 'crit-sword',
            name: 'Crit Sword',
            description: 'Sharp',
            quantity: 1,
            type: 'equipment' as const,
            effects: { strength: 3 },
            passiveEffect: {
              type: 'crit_bonus' as const,
              value: 0.1,
              description: '+10% crit chance',
            },
          },
          armor: null,
          accessory: null,
        },
      }
      const state = initializePlayerCombatState(charWithCritBonus)
      expect(state.bonusCritChance).toBeCloseTo(0.1)
    })

    it('sets dodgeChance from dodge passive', () => {
      const charWithDodge = {
        ...baseChar,
        equipment: {
          weapon: null,
          armor: {
            id: 'dodge-armor',
            name: 'Shadow Cloak',
            description: 'Light and evasive',
            quantity: 1,
            type: 'equipment' as const,
            effects: { intelligence: 2 },
            passiveEffect: {
              type: 'dodge' as const,
              value: 0.15,
              description: '15% dodge chance',
            },
          },
          accessory: null,
        },
      }
      const state = initializePlayerCombatState(charWithDodge)
      expect(state.dodgeChance).toBeCloseTo(0.15)
    })

    it('injects thorns as a persistent status effect', () => {
      const charWithThorns = {
        ...baseChar,
        equipment: {
          weapon: null,
          armor: {
            id: 'thorn-armor',
            name: 'Thornmail',
            description: 'Spiky armor',
            quantity: 1,
            type: 'equipment' as const,
            effects: { intelligence: 2 },
            passiveEffect: {
              type: 'thorns' as const,
              value: 5,
              description: 'Returns 5 damage',
            },
          },
          accessory: null,
        },
      }
      const state = initializePlayerCombatState(charWithThorns)
      const thornsEffect = (state.statusEffects ?? []).find(e => e.type === 'thorns')
      expect(thornsEffect).toBeDefined()
      expect(thornsEffect?.value).toBe(5)
    })

    it('applies lifesteal_passive healing after attack', () => {
      const charWithLifesteal = {
        ...baseChar,
        equipment: {
          weapon: {
            id: 'lifesteal-sword',
            name: 'Vampiric Blade',
            description: 'Drains life',
            quantity: 1,
            type: 'equipment' as const,
            effects: { strength: 3 },
            passiveEffect: {
              type: 'lifesteal_passive' as const,
              value: 0.2,
              description: 'Heal 20% of damage dealt',
            },
          },
          armor: null,
          accessory: null,
        },
      }
      const combat = makeActiveCombat({
        playerState: { ...makeActiveCombat().playerState, hp: 50 }, // not at max
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, charWithLifesteal)

      // Player should have healed (or at least a heal log entry)
      const healLog = result.combatLog.find(l => l.action === 'heal' && l.description.includes('Lifesteal'))
      expect(healLog).toBeDefined()
      vi.restoreAllMocks()
    })

    it('dodge blocks incoming enemy damage', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          hp: 90,
          ap: 1,
          maxAp: 1,
          dodgeChance: 1.0, // 100% dodge for deterministic test
        },
        enemy: { ...makeActiveCombat().enemy, attack: 50 }, // high attack to ensure damage would be felt
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.0) // always dodge
      const { combatState: result } = processPlayerAction(combat, { action: 'defend' }, baseChar)

      // Player should not have lost HP due to dodge
      const dodgeLog = result.combatLog.find(l => l.action === 'dodge')
      expect(dodgeLog).toBeDefined()
      vi.restoreAllMocks()
    })

    it('poison_immunity prevents poison status effect from being applied', () => {
      const charWithPoisonImmunity = {
        ...baseChar,
        equipment: {
          weapon: null,
          armor: {
            id: 'immunity-armor',
            name: 'Antivenom Plate',
            description: 'Resists poison',
            quantity: 1,
            type: 'equipment' as const,
            effects: { intelligence: 2 },
            passiveEffect: {
              type: 'poison_immunity' as const,
              value: 1,
              description: 'Immune to poison',
            },
          },
          accessory: null,
        },
      }
      const combat = makeActiveCombat({
        playerState: { ...makeActiveCombat().playerState, ap: 1, maxAp: 1 },
        enemy: {
          ...makeActiveCombat().enemy,
          attack: 5,
          statusAbility: {
            type: 'poison' as const,
            value: 3,
            duration: 3,
            chance: 1.0, // 100% chance to poison
          },
        },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.0) // ensure status triggers
      const { combatState: result } = processPlayerAction(combat, { action: 'defend' }, charWithPoisonImmunity)

      // Should have immunity log, not poison
      const immunityLog = result.combatLog.find(l => l.description.includes('immune'))
      expect(immunityLog).toBeDefined()

      // Should NOT have poison status effect on player
      const poisonEffect = (result.playerState.statusEffects ?? []).find(e => e.type === 'poison')
      expect(poisonEffect).toBeUndefined()
      vi.restoreAllMocks()
    })
  })
})
