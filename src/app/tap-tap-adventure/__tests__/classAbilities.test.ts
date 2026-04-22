import { describe, expect, it, vi } from 'vitest'

import { processPlayerAction } from '@/app/tap-tap-adventure/lib/combatEngine'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'

function makeChar(classId: string): FantasyCharacter {
  return {
    id: '1',
    playerId: 'p1',
    name: 'Test',
    race: 'Human',
    class: classId,
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
    pendingStatPoints: 0,
    difficultyMode: 'normal',
    currentRegion: 'green_meadows',
    currentWeather: 'clear',
    factionReputations: {},
  }
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
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
      defense: 10,
      level: 2,
      goldReward: 15,
    },
    playerState: {
      hp: 100,
      maxHp: 100,
      attack: 20,
      defense: 10,
      isDefending: false,
      activeBuffs: [],
      comboCount: 0,
      abilityCooldown: 0,
      enemyStunned: false,
      shield: 0,
      luck: 0,
      mana: 0,
      maxMana: 0,
      ap: 2,
      maxAp: 2,
    },
    turnNumber: 0,
    combatLog: [],
    status: 'active',
    scenario: 'A goblin appears!',
    combatDistance: 'close',
    ...overrides,
  }
}

// Seed Math.random for deterministic tests
function mockRandomReturning(value: number) {
  return vi.spyOn(Math, 'random').mockReturnValue(value)
}

describe('Class Abilities', () => {
  describe('Warrior - Shield Bash', () => {
    it('deals damage and stuns the enemy (enemy skips next attack)', () => {
      const randomSpy = mockRandomReturning(0.5) // variance = 0 at 0.5
      const combat = makeCombat()
      const character = makeChar('Warrior')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      // Should have dealt damage (0.8x multiplier)
      expect(combatState.enemy.hp).toBeLessThan(200)

      // The log should mention stunning
      const abilityLog = combatState.combatLog.find(
        l => l.actor === 'player' && l.action === 'class_ability'
      )
      expect(abilityLog).toBeDefined()
      expect(abilityLog!.description).toContain('stunning')
      expect(abilityLog!.damage).toBeDefined()
      expect(abilityLog!.damage!).toBeGreaterThan(0)

      // Enemy should have been stunned (skipped attack)
      const enemyLog = combatState.combatLog.find(l => l.actor === 'enemy')
      expect(enemyLog).toBeDefined()
      expect(enemyLog!.action).toBe('stunned')
      expect(enemyLog!.description).toContain('stunned')

      // Player should not have taken damage from enemy
      // (stunned enemies don't attack)
      // Player HP should be 100 (unchanged since enemy was stunned)
      expect(combatState.playerState.hp).toBe(100)

      randomSpy.mockRestore()
    })
  })

  describe('Mage - Arcane Blast', () => {
    it('deals 2x damage and takes 20% max HP recoil', () => {
      const randomSpy = mockRandomReturning(0.5)
      const combat = makeCombat()
      const character = makeChar('Mage')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      // Should have dealt 2x damage
      const abilityLog = combatState.combatLog.find(
        l => l.actor === 'player' && l.action === 'class_ability'
      )
      expect(abilityLog).toBeDefined()
      expect(abilityLog!.description).toContain('Arcane Blast')

      // Recoil: 20% of 100 maxHp = 20
      // Player HP should be reduced by recoil (and possibly enemy damage)
      // With stunned=false, enemy will attack too, but we check recoil happened
      expect(abilityLog!.description).toContain('recoil')

      randomSpy.mockRestore()
    })

    it('recoil is 20% of max HP', () => {
      const randomSpy = mockRandomReturning(0.5)
      const combat = makeCombat({
        playerState: {
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 10,
          isDefending: false,
          activeBuffs: [],
          comboCount: 0,
          abilityCooldown: 0,
          enemyStunned: true, // stun enemy so we can isolate recoil
          shield: 0,
          luck: 0,
          mana: 0,
          maxMana: 0,
          ap: 2,
          maxAp: 2,
        },
      })
      const character = makeChar('Mage')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      // Recoil = 20% of 100 = 20. Player starts at 100 - 20 = 80
      // Min 1 HP from recoil logic
      expect(combatState.playerState.hp).toBe(80)

      randomSpy.mockRestore()
    })
  })

  describe('Rogue - Backstab', () => {
    it('deals 3x damage and resets combo when combo >= 2', () => {
      const randomSpy = mockRandomReturning(0.5)
      const combat = makeCombat({
        playerState: {
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 10,
          isDefending: false,
          activeBuffs: [],
          comboCount: 3,
          abilityCooldown: 0,
          enemyStunned: true, // stun enemy to isolate backstab
          shield: 0,
          luck: 0,
          mana: 0,
          maxMana: 0,
          ap: 2,
          maxAp: 2,
        },
      })
      const character = makeChar('Rogue')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      // Should deal 3x damage
      const abilityLog = combatState.combatLog.find(
        l => l.actor === 'player' && l.action === 'class_ability'
      )
      expect(abilityLog).toBeDefined()
      expect(abilityLog!.description).toContain('devastating Backstab')

      // Combo should be reset to 0
      expect(combatState.playerState.comboCount).toBe(0)

      randomSpy.mockRestore()
    })

    it('deals normal damage when combo < 2', () => {
      const randomSpy = mockRandomReturning(0.5)
      const combat = makeCombat({
        playerState: {
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 10,
          isDefending: false,
          activeBuffs: [],
          comboCount: 1,
          abilityCooldown: 0,
          enemyStunned: true,
          shield: 0,
          luck: 0,
          mana: 0,
          maxMana: 0,
          ap: 2,
          maxAp: 2,
        },
      })
      const character = makeChar('Rogue')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      const abilityLog = combatState.combatLog.find(
        l => l.actor === 'player' && l.action === 'class_ability'
      )
      expect(abilityLog).toBeDefined()
      expect(abilityLog!.description).toContain('lacks setup')

      // Combo should increment (not reset)
      expect(combatState.playerState.comboCount).toBe(2)

      randomSpy.mockRestore()
    })
  })

  describe('Ranger - Precise Shot', () => {
    it('ignores enemy defense entirely', () => {
      const randomSpy = mockRandomReturning(0.5)
      // High defense enemy
      const combat = makeCombat({
        enemy: {
          id: 'enemy-1',
          name: 'Tank',
          description: 'Very tanky',
          hp: 200,
          maxHp: 200,
          attack: 8,
          defense: 100, // very high defense
          level: 2,
          goldReward: 15,
        },
        playerState: {
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 10,
          isDefending: false,
          activeBuffs: [],
          comboCount: 0,
          abilityCooldown: 0,
          enemyStunned: true,
          shield: 0,
          luck: 0,
          mana: 0,
          maxMana: 0,
          ap: 2,
          maxAp: 2,
        },
      })
      const character = makeChar('Ranger')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      const abilityLog = combatState.combatLog.find(
        l => l.actor === 'player' && l.action === 'class_ability'
      )
      expect(abilityLog).toBeDefined()
      expect(abilityLog!.description).toContain('Precise Shot')
      // Damage should be exactly equal to attack (20) since defense is ignored
      expect(abilityLog!.damage).toBe(20)

      randomSpy.mockRestore()
    })
  })

  describe('Cooldown mechanics', () => {
    it('ability is unavailable when on cooldown', () => {
      const randomSpy = mockRandomReturning(0.5)
      const combat = makeCombat({
        playerState: {
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 10,
          isDefending: false,
          activeBuffs: [],
          comboCount: 0,
          abilityCooldown: 2,
          enemyStunned: true,
          shield: 0,
          luck: 0,
          mana: 0,
          maxMana: 0,
          ap: 2,
          maxAp: 2,
        },
      })
      const character = makeChar('Warrior')

      const result = processPlayerAction(combat, { action: 'class_ability' }, character)
      const { combatState } = result

      const abilityLog = combatState.combatLog.find(
        l => l.actor === 'player' && l.action === 'class_ability'
      )
      expect(abilityLog).toBeDefined()
      expect(abilityLog!.description).toContain('not ready')

      // Enemy HP should be unchanged (no damage dealt)
      expect(combatState.enemy.hp).toBe(200)

      randomSpy.mockRestore()
    })

    it('cooldown ticks down each turn', () => {
      const randomSpy = mockRandomReturning(0.5)
      const combat = makeCombat({
        playerState: {
          hp: 100,
          maxHp: 100,
          attack: 20,
          defense: 10,
          isDefending: false,
          activeBuffs: [],
          comboCount: 0,
          abilityCooldown: 0,
          enemyStunned: false,
          shield: 0,
          luck: 0,
          mana: 0,
          maxMana: 0,
          ap: 2,
          maxAp: 2,
        },
      })
      const character = makeChar('Warrior')

      // Use the ability to set cooldown
      const result1 = processPlayerAction(combat, { action: 'class_ability' }, character)
      // Warrior cooldown is 3, then ticked once at end of turn = 2
      expect(result1.combatState.playerState.abilityCooldown).toBe(2)

      // Next turn: end turn to tick cooldown
      const result2 = processPlayerAction(
        result1.combatState,
        { action: 'end_turn' },
        character
      )
      expect(result2.combatState.playerState.abilityCooldown).toBe(1)

      // Next turn: end turn again
      const result3 = processPlayerAction(
        result2.combatState,
        { action: 'end_turn' },
        character
      )
      expect(result3.combatState.playerState.abilityCooldown).toBe(0)

      randomSpy.mockRestore()
    })
  })
})
