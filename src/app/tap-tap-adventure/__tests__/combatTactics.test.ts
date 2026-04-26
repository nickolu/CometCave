import { describe, expect, it, vi } from 'vitest'

import {
  checkBossPhaseChange,
  getComboMultiplier,
  generateEnemyTelegraph,
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
  distance: 55,
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
  inventory: [],
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
      ap: 1,
      maxAp: 1,
      stamina: 6,
      maxStamina: 6,
    },
    turnNumber: 0,
    combatLog: [],
    status: 'active',
    scenario: 'A goblin appears!',
    enemyTelegraph: null,
    combatDistance: 'close',
    ...overrides,
  }
}

describe('Combat Tactics', () => {
  describe('Combo System', () => {
    it('returns 1x multiplier for 0 combo', () => {
      expect(getComboMultiplier(0)).toBe(1)
    })

    it('returns 1.25x for 1 combo', () => {
      expect(getComboMultiplier(1)).toBe(1.25)
    })

    it('returns 1.5x for 2 combo', () => {
      expect(getComboMultiplier(2)).toBe(1.5)
    })

    it('caps at 1.75x', () => {
      expect(getComboMultiplier(3)).toBe(1.75)
      expect(getComboMultiplier(10)).toBe(1.75)
    })

    it('increments combo on attack', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.playerState.comboCount).toBe(1)
      vi.restoreAllMocks()
    })

    it('resets combo on defend', () => {
      const combat = makeActiveCombat({
        playerState: { ...makeActiveCombat().playerState, comboCount: 3 },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'defend' }, baseChar)
      expect(result.playerState.comboCount).toBe(0)
      vi.restoreAllMocks()
    })

    it('resets combo on use_item', () => {
      const combat = makeActiveCombat({
        playerState: { ...makeActiveCombat().playerState, comboCount: 2 },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(
        combat,
        { action: 'use_item', itemId: 'nonexistent' },
        baseChar
      )
      expect(result.playerState.comboCount).toBe(0)
      vi.restoreAllMocks()
    })
  })

  describe('Enemy Telegraphing', () => {
    it('generates a telegraph with valid action', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const telegraph = generateEnemyTelegraph(
        makeActiveCombat().enemy,
        1,
        false
      )
      expect(['heavy_attack', 'special', 'defend', 'normal_attack']).toContain(telegraph.action)
      expect(telegraph.description).toBeTruthy()
      vi.restoreAllMocks()
    })

    it('telegraphs special ability when cooldown matches', () => {
      const enemy = {
        ...makeActiveCombat().enemy,
        specialAbility: { name: 'Fire Breath', description: 'Breathes fire', damage: 15, cooldown: 3 },
      }
      // Turn 2 + 1 = 3, which is divisible by cooldown 3
      const telegraph = generateEnemyTelegraph(enemy, 2, false)
      expect(telegraph.action).toBe('special')
      expect(telegraph.description).toContain('Fire Breath')
    })

    it('returns next telegraph after processing action', () => {
      const combat = makeActiveCombat()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.enemyTelegraph).not.toBeNull()
      expect(result.enemyTelegraph?.description).toBeTruthy()
      vi.restoreAllMocks()
    })

    it('clears telegraph on victory', () => {
      const combat = makeActiveCombat({
        enemy: { ...makeActiveCombat().enemy, hp: 1, defense: 0 },
        enemyTelegraph: { action: 'heavy_attack', description: 'Winding up!' },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { combatState: result } = processPlayerAction(combat, { action: 'attack' }, baseChar)
      expect(result.status).toBe('victory')
      expect(result.enemyTelegraph).toBeNull()
      vi.restoreAllMocks()
    })
  })

  describe('Enemy Defend', () => {
    it('non-boss enemy can telegraph defend', () => {
      // Enemy has no specialAbility, so specialReady is false (no random call).
      // First random call: heavyChance (0.2) — need > 0.2 to skip.
      // Second random call: defendChance (0.1) — need < 0.1 to trigger defend.
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.99) // heavyChance: > 0.2, skip heavy
        .mockReturnValueOnce(0.05) // defendChance: < 0.1, trigger defend
      const telegraph = generateEnemyTelegraph(makeActiveCombat().enemy, 1, false)
      expect(telegraph.action).toBe('defend')
      expect(telegraph.description).toContain('braces')
      vi.restoreAllMocks()
    })

    it('when enemy telegraphs defend, player attack damage is reduced', () => {
      // Set up combat with enemy telegraphing defend
      const combat = makeActiveCombat({
        enemyTelegraph: { action: 'defend', description: 'Goblin braces and raises their guard.' },
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      // Attack with defend telegraph
      const { combatState: withDefend } = processPlayerAction(combat, { action: 'attack' }, baseChar)

      // Attack without defend telegraph
      const combatNoDefend = makeActiveCombat({
        enemyTelegraph: { action: 'normal_attack', description: 'Goblin readies an attack.' },
      })
      const { combatState: withoutDefend } = processPlayerAction(combatNoDefend, { action: 'attack' }, baseChar)

      // Enemy should have taken less damage when defending
      const damageWithDefend = 30 - withDefend.enemy.hp
      const damageWithoutDefend = 30 - withoutDefend.enemy.hp
      expect(damageWithDefend).toBeLessThan(damageWithoutDefend)
      vi.restoreAllMocks()
    })

    it('enemy defend telegraph shows correct description', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.99)
        .mockReturnValueOnce(0.05)
      const telegraph = generateEnemyTelegraph(makeActiveCombat().enemy, 1, false)
      expect(telegraph.action).toBe('defend')
      expect(telegraph.description).toBe('Goblin braces and raises their guard.')
      vi.restoreAllMocks()
    })
  })

  describe('Boss Phase Change', () => {
    it('does not trigger for non-boss', () => {
      const enemy = { ...makeActiveCombat().enemy, hp: 10, maxHp: 100 }
      const { phaseChanged } = checkBossPhaseChange(enemy, false, false)
      expect(phaseChanged).toBe(false)
    })

    it('does not trigger when boss HP above 50%', () => {
      const enemy = { ...makeActiveCombat().enemy, hp: 60, maxHp: 100 }
      const { phaseChanged } = checkBossPhaseChange(enemy, true, false)
      expect(phaseChanged).toBe(false)
    })

    it('triggers when boss HP drops below 50%', () => {
      const enemy = { ...makeActiveCombat().enemy, hp: 49, maxHp: 100 }
      const { enemy: enraged, phaseChanged, log } = checkBossPhaseChange(enemy, true, false)
      expect(phaseChanged).toBe(true)
      expect(enraged.name).toContain('Enraged')
      expect(enraged.attack).toBeGreaterThan(enemy.attack)
      expect(enraged.defense).toBeGreaterThan(enemy.defense)
      expect(log?.description).toContain('enraged')
    })

    it('does not trigger twice', () => {
      const enemy = { ...makeActiveCombat().enemy, hp: 30, maxHp: 100, name: 'Boss (Enraged)' }
      const { phaseChanged } = checkBossPhaseChange(enemy, true, true)
      expect(phaseChanged).toBe(false)
    })
  })

  describe('Player state initialization', () => {
    it('initializes comboCount to 0', () => {
      const state = initializePlayerCombatState(baseChar)
      expect(state.comboCount).toBe(0)
    })
  })
})
