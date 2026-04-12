import { describe, expect, it, vi } from 'vitest'

import {
  initializePlayerCombatState,
  processPlayerAction,
} from '@/app/tap-tap-adventure/lib/combatEngine'
import { AP_COSTS, MAX_AP } from '@/app/tap-tap-adventure/config/apCosts'
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
      hp: 200,
      maxHp: 200,
      attack: 8,
      defense: 3,
      level: 2,
      goldReward: 15,
      lootTable: [],
    },
    playerState: {
      hp: 90,
      maxHp: 90,
      attack: 24,
      defense: 11,
      isDefending: false,
      activeBuffs: [],
      comboCount: 0,
      ap: MAX_AP,
      maxAp: MAX_AP,
      turnActions: [],
    },
    turnNumber: 0,
    combatLog: [],
    status: 'active',
    scenario: 'A goblin appears!',
    turnPhase: 'player',
    ...overrides,
  }
}

describe('Action Points System', () => {
  describe('initialization', () => {
    it('initializes player with correct AP values', () => {
      const state = initializePlayerCombatState(baseChar)
      expect(state.ap).toBe(MAX_AP)
      expect(state.maxAp).toBe(MAX_AP)
      expect(state.turnActions).toEqual([])
    })
  })

  describe('AP deduction', () => {
    it('deducts 1 AP for attack', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - AP_COSTS.attack)
      expect(result.combatState.turnPhase).toBe('player')
    })

    it('deducts 1 AP for defend', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'defend' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - AP_COSTS.defend)
      expect(result.combatState.turnPhase).toBe('player')
    })

    it('deducts 2 AP for heavy_attack', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'heavy_attack' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - AP_COSTS.heavy_attack)
      expect(result.combatState.turnPhase).toBe('player')
    })

    it('deducts 1 AP for use_item', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'use_item', itemId: 'potion-1' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - AP_COSTS.use_item)
      expect(result.combatState.turnPhase).toBe('player')
    })

    it('deducts 2 AP for cast_spell', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'cast_spell' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - AP_COSTS.cast_spell)
      expect(result.combatState.turnPhase).toBe('player')
    })

    it('deducts 2 AP for class_ability', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'class_ability' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - AP_COSTS.class_ability)
      // With 1 AP left, still player turn
      expect(result.combatState.turnPhase).toBe('player')
    })
  })

  describe('insufficient AP', () => {
    it('prevents action when not enough AP', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 1,
        },
      })
      // heavy_attack costs 2 AP, player has 1
      const result = processPlayerAction(combat, { action: 'heavy_attack' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(1) // AP unchanged
      const lastLog = result.combatState.combatLog[result.combatState.combatLog.length - 1]
      expect(lastLog.description).toContain('Not enough AP')
    })

    it('prevents flee when not enough AP', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 2,
        },
      })
      // flee costs 3 AP, player has 2
      const result = processPlayerAction(combat, { action: 'flee' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(2) // AP unchanged
      const lastLog = result.combatState.combatLog[result.combatState.combatLog.length - 1]
      expect(lastLog.description).toContain('Not enough AP')
    })
  })

  describe('enemy turn trigger', () => {
    it('triggers enemy turn when AP reaches 0', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 1,
        },
      })
      // attack costs 1 AP, player will have 0 after
      const result = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatState.turnPhase).toBe('enemy_done')
      // AP should be reset for next turn
      expect(result.combatState.playerState.ap).toBe(MAX_AP)
      expect(result.combatState.playerState.turnActions).toEqual([])
    })

    it('triggers enemy turn on end_turn', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'end_turn' }, baseChar)
      expect(result.combatState.turnPhase).toBe('enemy_done')
      expect(result.combatState.playerState.ap).toBe(MAX_AP)
      expect(result.combatState.playerState.turnActions).toEqual([])
    })

    it('allows end_turn even with full AP', () => {
      const combat = makeActiveCombat()
      expect(combat.playerState.ap).toBe(MAX_AP)
      const result = processPlayerAction(combat, { action: 'end_turn' }, baseChar)
      expect(result.combatState.turnPhase).toBe('enemy_done')
    })
  })

  describe('multi-action turn', () => {
    it('allows multiple actions in one turn', () => {
      let combat = makeActiveCombat()

      // First action: attack (1 AP)
      let result = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(2)
      expect(result.combatState.turnPhase).toBe('player')
      expect(result.combatState.playerState.turnActions).toEqual(['attack'])

      // Second action: defend (1 AP)
      result = processPlayerAction(result.combatState, { action: 'defend' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(1)
      expect(result.combatState.turnPhase).toBe('player')
      expect(result.combatState.playerState.turnActions).toEqual(['attack', 'defend'])

      // Third action: attack (1 AP) -> AP reaches 0, enemy acts
      result = processPlayerAction(result.combatState, { action: 'attack' }, baseChar)
      expect(result.combatState.turnPhase).toBe('enemy_done')
      expect(result.combatState.playerState.ap).toBe(MAX_AP) // Reset after enemy turn
      expect(result.combatState.playerState.turnActions).toEqual([]) // Cleared after enemy turn
    })
  })

  describe('heavy attack', () => {
    it('deals more damage than normal attack', () => {
      // Use deterministic seeding approach by running many times and comparing averages
      let totalNormalDmg = 0
      let totalHeavyDmg = 0
      const iterations = 50

      for (let i = 0; i < iterations; i++) {
        const normalCombat = makeActiveCombat()
        const normalResult = processPlayerAction(normalCombat, { action: 'attack' }, baseChar)
        const normalLog = normalResult.combatState.combatLog.find(l => l.actor === 'player' && l.damage)
        totalNormalDmg += normalLog?.damage ?? 0

        const heavyCombat = makeActiveCombat()
        const heavyResult = processPlayerAction(heavyCombat, { action: 'heavy_attack' }, baseChar)
        const heavyLog = heavyResult.combatState.combatLog.find(l => l.actor === 'player' && l.damage)
        totalHeavyDmg += heavyLog?.damage ?? 0
      }

      // Heavy attack should deal more on average (1.8x multiplier)
      expect(totalHeavyDmg / iterations).toBeGreaterThan(totalNormalDmg / iterations)
    })

    it('costs 2 AP', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'heavy_attack' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP - 2)
    })

    it('builds combo like normal attack', () => {
      const combat = makeActiveCombat()
      const result = processPlayerAction(combat, { action: 'heavy_attack' }, baseChar)
      expect(result.combatState.playerState.comboCount).toBe(1)
    })
  })

  describe('AP resets after enemy turn', () => {
    it('resets AP to max after enemy turn via end_turn', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 2,
        },
      })
      const result = processPlayerAction(combat, { action: 'end_turn' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP)
    })

    it('resets AP to max after AP naturally reaches 0', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 1,
        },
      })
      const result = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(MAX_AP)
    })
  })

  describe('flee costs 3 AP (whole turn)', () => {
    it('flee costs 3 AP', () => {
      expect(AP_COSTS.flee).toBe(3)
    })

    it('cannot flee with less than 3 AP', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 2,
        },
      })
      const result = processPlayerAction(combat, { action: 'flee' }, baseChar)
      expect(result.combatState.playerState.ap).toBe(2) // unchanged
    })
  })

  describe('defend does not stack', () => {
    it('defending twice does not double defense', () => {
      let combat = makeActiveCombat()

      // First defend
      let result = processPlayerAction(combat, { action: 'defend' }, baseChar)
      expect(result.combatState.playerState.isDefending).toBe(true)

      // Second defend (should still be defending but not double)
      result = processPlayerAction(result.combatState, { action: 'defend' }, baseChar)
      expect(result.combatState.playerState.isDefending).toBe(true)
      // The log should say "reinforce" not "doubling"
      const lastLog = result.combatState.combatLog[result.combatState.combatLog.length - 1]
      expect(lastLog.description).toContain('reinforce')
    })
  })

  describe('turnActions tracking', () => {
    it('tracks actions taken during a turn', () => {
      let combat = makeActiveCombat()
      let result = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatState.playerState.turnActions).toEqual(['attack'])

      result = processPlayerAction(result.combatState, { action: 'defend' }, baseChar)
      expect(result.combatState.playerState.turnActions).toEqual(['attack', 'defend'])
    })

    it('clears turnActions after enemy turn', () => {
      const combat = makeActiveCombat({
        playerState: {
          ...makeActiveCombat().playerState,
          ap: 1,
        },
      })
      const result = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.combatState.turnPhase).toBe('enemy_done')
      expect(result.combatState.playerState.turnActions).toEqual([])
    })
  })
})
