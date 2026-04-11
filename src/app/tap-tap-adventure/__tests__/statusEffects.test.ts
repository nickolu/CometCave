import { describe, expect, it, vi } from 'vitest'

import {
  applyStatusEffect,
  checkFearSkip,
  createStatusEffectFromAbility,
  getBerserkAttackMultiplier,
  getBerserkDefenseMultiplier,
  getBurnDefenseMultiplier,
  getCurseHealingMultiplier,
  getEffectModifier,
  getSlowMultiplier,
  getThornsDamage,
  hasStatusEffect,
  processReflect,
  removeExpiredEffects,
  tickStatusEffects,
} from '@/app/tap-tap-adventure/lib/statusEffects'
import { CombatEnemy, CombatPlayerState, StatusEffect } from '@/app/tap-tap-adventure/models/combat'

function makeEffect(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id: 'test-effect-1',
    name: 'Test Effect',
    type: 'poison',
    value: 5,
    turnsRemaining: 3,
    source: 'enemy',
    ...overrides,
  }
}

function makePlayerState(overrides: Partial<CombatPlayerState> = {}): CombatPlayerState {
  return {
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 5,
    isDefending: false,
    comboCount: 0,
    abilityCooldown: 0,
    enemyStunned: false,
    mana: 50,
    maxMana: 50,
    shield: 0,
    statusEffects: [],
    ...overrides,
  }
}

function makeEnemy(overrides: Partial<CombatEnemy> = {}): CombatEnemy {
  return {
    id: 'enemy-1',
    name: 'Goblin',
    description: 'A nasty goblin',
    hp: 50,
    maxHp: 50,
    attack: 8,
    defense: 3,
    level: 2,
    goldReward: 10,
    statusEffects: [],
    ...overrides,
  }
}

describe('Status Effects System', () => {
  describe('applyStatusEffect', () => {
    it('should add a new status effect', () => {
      const effects: StatusEffect[] = []
      const newEffect = makeEffect({ type: 'poison', value: 5, turnsRemaining: 3 })
      const result = applyStatusEffect(effects, newEffect)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('poison')
    })

    it('should refresh existing effect with higher values', () => {
      const effects = [makeEffect({ type: 'poison', value: 3, turnsRemaining: 2 })]
      const newEffect = makeEffect({ type: 'poison', value: 5, turnsRemaining: 4 })
      const result = applyStatusEffect(effects, newEffect)
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(5)
      expect(result[0].turnsRemaining).toBe(4)
    })

    it('should keep existing value if higher', () => {
      const effects = [makeEffect({ type: 'poison', value: 10, turnsRemaining: 5 })]
      const newEffect = makeEffect({ type: 'poison', value: 3, turnsRemaining: 2 })
      const result = applyStatusEffect(effects, newEffect)
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(10)
      expect(result[0].turnsRemaining).toBe(5)
    })
  })

  describe('hasStatusEffect', () => {
    it('should return true when effect exists', () => {
      const effects = [makeEffect({ type: 'poison', turnsRemaining: 2 })]
      expect(hasStatusEffect(effects, 'poison')).toBe(true)
    })

    it('should return false when effect does not exist', () => {
      const effects = [makeEffect({ type: 'poison' })]
      expect(hasStatusEffect(effects, 'burn')).toBe(false)
    })

    it('should return false when effect is expired', () => {
      const effects = [makeEffect({ type: 'poison', turnsRemaining: 0 })]
      expect(hasStatusEffect(effects, 'poison')).toBe(false)
    })

    it('should handle undefined', () => {
      expect(hasStatusEffect(undefined, 'poison')).toBe(false)
    })
  })

  describe('getEffectModifier', () => {
    it('should return value of effect', () => {
      const effects = [makeEffect({ type: 'thorns', value: 8 })]
      expect(getEffectModifier(effects, 'thorns')).toBe(8)
    })

    it('should return 0 for missing effect', () => {
      expect(getEffectModifier([], 'thorns')).toBe(0)
    })
  })

  describe('removeExpiredEffects', () => {
    it('should remove effects with turnsRemaining <= 0', () => {
      const effects = [
        makeEffect({ type: 'poison', turnsRemaining: 0 }),
        makeEffect({ type: 'burn', turnsRemaining: 2, id: 'e2' }),
      ]
      const result = removeExpiredEffects(effects)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('burn')
    })
  })

  describe('tickStatusEffects - poison', () => {
    it('should deal poison damage to player each turn', () => {
      const player = makePlayerState({
        hp: 50,
        statusEffects: [makeEffect({ type: 'poison', value: 5, turnsRemaining: 2 })],
      })
      const enemy = makeEnemy()
      const result = tickStatusEffects(player, enemy, 1)

      expect(result.playerState.hp).toBe(45) // 50 - 5 poison damage
      expect(result.logs.some(l => l.description.includes('poison damage'))).toBe(true)
    })

    it('should deal poison damage to enemy each turn', () => {
      const player = makePlayerState()
      const enemy = makeEnemy({
        hp: 30,
        statusEffects: [makeEffect({ type: 'poison', value: 4, turnsRemaining: 2, source: 'player' })],
      })
      const result = tickStatusEffects(player, enemy, 1)

      expect(result.enemy.hp).toBe(26) // 30 - 4 poison damage
    })

    it('should decrement turnsRemaining and remove expired effects', () => {
      const player = makePlayerState({
        statusEffects: [makeEffect({ type: 'poison', value: 3, turnsRemaining: 1 })],
      })
      const enemy = makeEnemy()
      const result = tickStatusEffects(player, enemy, 1)

      // After tick, turnsRemaining goes from 1 to 0, which gets removed
      expect(result.playerState.statusEffects).toHaveLength(0)
    })
  })

  describe('tickStatusEffects - burn', () => {
    it('should deal burn damage to target', () => {
      const player = makePlayerState({
        hp: 80,
        statusEffects: [makeEffect({ type: 'burn', value: 7, turnsRemaining: 3 })],
      })
      const enemy = makeEnemy()
      const result = tickStatusEffects(player, enemy, 1)

      expect(result.playerState.hp).toBe(73)
      expect(result.logs.some(l => l.description.includes('burn damage'))).toBe(true)
      expect(result.logs.some(l => l.description.includes('defense is reduced'))).toBe(true)
    })
  })

  describe('slow modifier', () => {
    it('should reduce enemy attack by 30% when slowed', () => {
      const effects = [makeEffect({ type: 'slow', turnsRemaining: 2 })]
      expect(getSlowMultiplier(effects)).toBe(0.7)
    })

    it('should return 1 when not slowed', () => {
      expect(getSlowMultiplier([])).toBe(1)
    })
  })

  describe('curse modifier', () => {
    it('should halve healing when cursed', () => {
      const effects = [makeEffect({ type: 'curse', turnsRemaining: 2 })]
      expect(getCurseHealingMultiplier(effects)).toBe(0.5)
    })

    it('should return 1 when not cursed', () => {
      expect(getCurseHealingMultiplier([])).toBe(1)
    })
  })

  describe('thorns', () => {
    it('should return thorns damage value', () => {
      const effects = [makeEffect({ type: 'thorns', value: 6, turnsRemaining: 3 })]
      expect(getThornsDamage(effects)).toBe(6)
    })

    it('should return 0 when no thorns', () => {
      expect(getThornsDamage([])).toBe(0)
    })
  })

  describe('berserk modifier', () => {
    it('should increase attack by 50% when berserk', () => {
      const effects = [makeEffect({ type: 'berserk', turnsRemaining: 2 })]
      expect(getBerserkAttackMultiplier(effects)).toBe(1.5)
    })

    it('should reduce defense by 30% when berserk', () => {
      const effects = [makeEffect({ type: 'berserk', turnsRemaining: 2 })]
      expect(getBerserkDefenseMultiplier(effects)).toBe(0.7)
    })

    it('should return 1 when not berserk', () => {
      expect(getBerserkAttackMultiplier([])).toBe(1)
      expect(getBerserkDefenseMultiplier([])).toBe(1)
    })
  })

  describe('burn defense modifier', () => {
    it('should reduce defense by 20% when burning', () => {
      const effects = [makeEffect({ type: 'burn', turnsRemaining: 2 })]
      expect(getBurnDefenseMultiplier(effects)).toBe(0.8)
    })
  })

  describe('fear', () => {
    it('should have 50% chance to skip action when feared', () => {
      const effects = [makeEffect({ type: 'fear', turnsRemaining: 2 })]

      // Mock Math.random to return 0.3 (below 0.5, should skip)
      vi.spyOn(Math, 'random').mockReturnValue(0.3)
      expect(checkFearSkip(effects)).toBe(true)

      // Mock Math.random to return 0.7 (above 0.5, should not skip)
      vi.spyOn(Math, 'random').mockReturnValue(0.7)
      expect(checkFearSkip(effects)).toBe(false)

      vi.restoreAllMocks()
    })

    it('should not skip when not feared', () => {
      expect(checkFearSkip([])).toBe(false)
    })
  })

  describe('reflect', () => {
    it('should reflect damage up to effect value', () => {
      const effects = [makeEffect({ type: 'reflect', value: 20, turnsRemaining: 3 })]
      const result = processReflect(effects, 15)

      expect(result.reflectedDamage).toBe(15)
      // Remaining reflect: 20 - 15 = 5
      expect(result.updatedEffects).toHaveLength(1)
      expect(result.updatedEffects[0].value).toBe(5)
    })

    it('should cap reflected damage at effect value', () => {
      const effects = [makeEffect({ type: 'reflect', value: 10, turnsRemaining: 3 })]
      const result = processReflect(effects, 25)

      expect(result.reflectedDamage).toBe(10)
      // Reflect exhausted, effect removed
      expect(result.updatedEffects).toHaveLength(0)
    })

    it('should return 0 when no reflect', () => {
      const result = processReflect([], 10)
      expect(result.reflectedDamage).toBe(0)
    })
  })

  describe('effect expiration', () => {
    it('should remove effects after their duration expires', () => {
      const player = makePlayerState({
        statusEffects: [
          makeEffect({ type: 'poison', turnsRemaining: 1 }),
          makeEffect({ type: 'burn', turnsRemaining: 3, id: 'e2' }),
        ],
      })
      const enemy = makeEnemy()

      const result = tickStatusEffects(player, enemy, 1)
      // Poison had 1 turn, goes to 0, gets removed
      // Burn had 3 turns, goes to 2, stays
      expect(result.playerState.statusEffects).toHaveLength(1)
      expect(result.playerState.statusEffects![0].type).toBe('burn')
      expect(result.playerState.statusEffects![0].turnsRemaining).toBe(2)
    })
  })

  describe('createStatusEffectFromAbility', () => {
    it('should create a status effect with correct properties', () => {
      const effect = createStatusEffectFromAbility('poison', 5, 3, 'enemy')
      expect(effect.type).toBe('poison')
      expect(effect.value).toBe(5)
      expect(effect.turnsRemaining).toBe(3)
      expect(effect.source).toBe('enemy')
      expect(effect.name).toBe('Poisoned')
      expect(effect.id).toContain('poison-')
    })

    it('should create different names for each type', () => {
      expect(createStatusEffectFromAbility('burn', 1, 1, 'player').name).toBe('Burning')
      expect(createStatusEffectFromAbility('slow', 1, 1, 'player').name).toBe('Slowed')
      expect(createStatusEffectFromAbility('curse', 1, 1, 'player').name).toBe('Cursed')
      expect(createStatusEffectFromAbility('thorns', 1, 1, 'player').name).toBe('Thorns')
      expect(createStatusEffectFromAbility('berserk', 1, 1, 'player').name).toBe('Berserk')
      expect(createStatusEffectFromAbility('fear', 1, 1, 'player').name).toBe('Feared')
      expect(createStatusEffectFromAbility('reflect', 1, 1, 'player').name).toBe('Reflecting')
    })
  })
})
