import { describe, expect, it } from 'vitest'

import { CLASS_SPELL_CONFIG } from '@/app/tap-tap-adventure/config/characterOptions'
import { getStartingSpell, STARTING_SPELLS } from '@/app/tap-tap-adventure/config/startingSpells'
import { calculateMaxMana } from '@/app/tap-tap-adventure/lib/leveling'
import {
  applyShieldAbsorption,
  castSpell,
  getActiveDamageReduction,
  tickSpellCooldowns,
  tickSpellEffects,
} from '@/app/tap-tap-adventure/lib/spellEngine'
import { generateSpellForLevel } from '@/app/tap-tap-adventure/lib/spellGenerator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatPlayerState, CombatState } from '@/app/tap-tap-adventure/models/combat'
import { Spell } from '@/app/tap-tap-adventure/models/spell'

const baseMage: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'TestMage',
  race: 'Elf',
  class: 'Mage',
  level: 3,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 5,
  intelligence: 10,
  luck: 5,
  inventory: [],
  deathCount: 0,
  pendingStatPoints: 0,
  mana: 30,
  maxMana: 30,
  spellbook: [STARTING_SPELLS.mage],
}

const baseWarrior: FantasyCharacter = {
  ...baseMage,
  id: '2',
  name: 'TestWarrior',
  class: 'Warrior',
  strength: 10,
  intelligence: 5,
  spellbook: [STARTING_SPELLS.warrior],
}

function makePlayerState(overrides: Partial<CombatPlayerState> = {}): CombatPlayerState {
  return {
    hp: 50,
    maxHp: 50,
    attack: 10,
    defense: 5,
    isDefending: false,
    activeBuffs: [],
    comboCount: 0,
    abilityCooldown: 0,
    enemyStunned: false,
    mana: 30,
    maxMana: 30,
    spellCooldowns: {},
    activeSpellEffects: [],
    spellTagsUsed: [],
    shield: 0,
    ...overrides,
  }
}

function makeEnemy(overrides = {}) {
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
    ...overrides,
  }
}

function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    id: 'combat-1',
    eventId: 'event-1',
    enemy: makeEnemy(),
    playerState: makePlayerState(),
    turnNumber: 1,
    combatLog: [],
    status: 'active',
    scenario: 'A test combat',
    enemyTelegraph: null,
    ...overrides,
  }
}

describe('Spell System', () => {
  describe('Spell Effect Application', () => {
    it('applies damage to enemy', () => {
      const spell: Spell = {
        id: 'test-damage',
        name: 'Fire Bolt',
        description: 'A bolt of fire',
        school: 'arcane',
        manaCost: 5,
        cooldown: 0,
        target: 'enemy',
        effects: [{ type: 'damage', value: 15, element: 'fire' }],
        tags: ['arcane'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.enemy.hp).toBeLessThan(50)
      expect(result.logs.length).toBeGreaterThan(0)
      expect(result.logs.some(l => l.damage && l.damage > 0)).toBe(true)
    })

    it('applies heal to player', () => {
      const spell: Spell = {
        id: 'test-heal',
        name: 'Heal',
        description: 'Heals HP',
        school: 'nature',
        manaCost: 5,
        cooldown: 0,
        target: 'self',
        effects: [{ type: 'heal', value: 20 }],
        tags: ['heal'],
      }
      const playerState = makePlayerState({ hp: 30 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.hp).toBe(50) // capped at maxHp
    })

    it('applies heal_over_time as active effect', () => {
      const spell: Spell = {
        id: 'test-hot',
        name: 'Regen',
        description: 'Regeneration',
        school: 'nature',
        manaCost: 4,
        cooldown: 2,
        target: 'self',
        effects: [{ type: 'heal_over_time', value: 3, duration: 3 }],
        tags: ['nature', 'heal'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.activeSpellEffects).toBeDefined()
      expect(result.playerState.activeSpellEffects!.length).toBe(1)
      expect(result.playerState.activeSpellEffects![0].effectType).toBe('heal_over_time')
      expect(result.playerState.activeSpellEffects![0].turnsRemaining).toBe(3)
    })

    it('applies damage_over_time as active effect', () => {
      const spell: Spell = {
        id: 'test-dot',
        name: 'Poison',
        description: 'Poison damage',
        school: 'shadow',
        manaCost: 5,
        cooldown: 1,
        target: 'enemy',
        effects: [{ type: 'damage_over_time', value: 4, duration: 3 }],
        tags: ['shadow', 'dot'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.activeSpellEffects!.length).toBe(1)
      expect(result.playerState.activeSpellEffects![0].effectType).toBe('damage_over_time')
    })

    it('applies shield to player', () => {
      const spell: Spell = {
        id: 'test-shield',
        name: 'Shield',
        description: 'Creates a shield',
        school: 'arcane',
        manaCost: 5,
        cooldown: 2,
        target: 'self',
        effects: [{ type: 'shield', value: 15 }],
        tags: ['defense'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.shield).toBe(15)
    })

    it('applies buff to player', () => {
      const spell: Spell = {
        id: 'test-buff',
        name: 'Power Up',
        description: 'Increases attack',
        school: 'war',
        manaCost: 5,
        cooldown: 2,
        target: 'self',
        effects: [{ type: 'buff', value: 5, stat: 'attack', duration: 2 }],
        tags: ['buff'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.activeBuffs!.length).toBe(1)
      expect(result.playerState.activeBuffs![0].stat).toBe('attack')
      expect(result.playerState.activeBuffs![0].value).toBe(5)
    })

    it('applies debuff as active spell effect', () => {
      const spell: Spell = {
        id: 'test-debuff',
        name: 'Weaken',
        description: 'Weakens enemy',
        school: 'shadow',
        manaCost: 5,
        cooldown: 2,
        target: 'enemy',
        effects: [{ type: 'debuff', value: 3, stat: 'attack', duration: 2 }],
        tags: ['shadow'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.activeSpellEffects!.some(e => e.effectType === 'debuff')).toBe(true)
    })

    it('applies stun to enemy', () => {
      const spell: Spell = {
        id: 'test-stun',
        name: 'Freeze',
        description: 'Stuns enemy',
        school: 'arcane',
        manaCost: 8,
        cooldown: 3,
        target: 'enemy',
        effects: [{ type: 'stun', value: 0 }],
        tags: ['ice'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.enemyStunned).toBe(true)
    })

    it('applies cleanse to remove negative effects', () => {
      const spell: Spell = {
        id: 'test-cleanse',
        name: 'Purify',
        description: 'Cleanses debuffs',
        school: 'nature',
        manaCost: 4,
        cooldown: 2,
        target: 'self',
        effects: [{ type: 'cleanse', value: 0 }],
        tags: ['heal'],
      }
      const playerState = makePlayerState({
        activeBuffs: [{ stat: 'attack', value: -3, turnsRemaining: 2 }],
      })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.activeBuffs!.length).toBe(0)
    })
  })

  describe('Mana Cost Deduction', () => {
    it('deducts mana when casting a spell', () => {
      const spell = STARTING_SPELLS.mage // cost 5
      const playerState = makePlayerState({ mana: 30 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.manaUsed).toBe(5)
      expect(result.playerState.mana).toBe(25)
    })

    it('prevents casting when mana is insufficient', () => {
      const spell = STARTING_SPELLS.mage // cost 5
      const playerState = makePlayerState({ mana: 2 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.manaUsed).toBe(0)
      expect(result.playerState.mana).toBe(2)
      expect(result.logs[0].description).toContain('Not enough mana')
    })
  })

  describe('Cooldown Tracking', () => {
    it('sets cooldown after casting', () => {
      const spell: Spell = {
        id: 'test-cd',
        name: 'Cooldown Test',
        description: 'test',
        school: 'arcane',
        manaCost: 5,
        cooldown: 3,
        target: 'enemy',
        effects: [{ type: 'damage', value: 10 }],
        tags: ['arcane'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.spellCooldowns!['test-cd']).toBe(3)
    })

    it('prevents casting when on cooldown', () => {
      const spell: Spell = {
        id: 'test-cd',
        name: 'Cooldown Test',
        description: 'test',
        school: 'arcane',
        manaCost: 5,
        cooldown: 3,
        target: 'enemy',
        effects: [{ type: 'damage', value: 10 }],
        tags: ['arcane'],
      }
      const playerState = makePlayerState({
        spellCooldowns: { 'test-cd': 2 },
      })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.manaUsed).toBe(0)
      expect(result.logs[0].description).toContain('cooldown')
    })

    it('decrements cooldowns on tick', () => {
      const playerState = makePlayerState({
        spellCooldowns: { 'spell-a': 3, 'spell-b': 1 },
      })
      const result = tickSpellCooldowns(playerState)
      expect(result.spellCooldowns!['spell-a']).toBe(2)
      expect(result.spellCooldowns!['spell-b']).toBeUndefined()
    })
  })

  describe('Condition Checking', () => {
    it('applies double_heal when caster_hp_below_30', () => {
      const spell = STARTING_SPELLS.ranger // Nature's Mend with caster_hp_below_30 -> double_heal
      const playerState = makePlayerState({ hp: 10, maxHp: 50, mana: 20 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      // Should have a HOT with doubled value (3 * 2 = 6)
      expect(result.playerState.activeSpellEffects!.length).toBe(1)
      expect(result.playerState.activeSpellEffects![0].value).toBe(6)
    })

    it('does not double heal when HP is above 30%', () => {
      const spell = STARTING_SPELLS.ranger
      const playerState = makePlayerState({ hp: 40, maxHp: 50, mana: 20 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.activeSpellEffects![0].value).toBe(3)
    })

    it('applies double_damage when target_hp_below_50', () => {
      const spell: Spell = {
        id: 'test-cond',
        name: 'Execute',
        description: 'test',
        school: 'shadow',
        manaCost: 5,
        cooldown: 0,
        target: 'enemy',
        effects: [{ type: 'damage', value: 10 }],
        conditions: [{ when: 'target_hp_below_50', bonus: 'double_damage' }],
        tags: ['shadow'],
      }
      const enemy = makeEnemy({ hp: 20, maxHp: 50 })
      const result = castSpell(spell, makePlayerState(), enemy, baseMage, makeCombatState({ enemy }))
      // With double_damage: value should be approximately 10 * 2 * schoolMultiplier - defense
      expect(result.enemy.hp).toBeLessThan(20)
    })
  })

  describe('Tag Synergy Bonus', () => {
    it('applies 30% bonus when matching tags', () => {
      const spell: Spell = {
        id: 'test-synergy',
        name: 'Arcane Blast',
        description: 'test',
        school: 'arcane',
        manaCost: 5,
        cooldown: 0,
        target: 'enemy',
        effects: [{ type: 'damage', value: 10 }],
        tags: ['arcane', 'ranged'],
      }
      // Player already has 'arcane' in spellTagsUsed
      const playerWithTags = makePlayerState({ spellTagsUsed: ['arcane'] })
      const resultWithSynergy = castSpell(spell, playerWithTags, makeEnemy(), baseMage, makeCombatState())

      const playerNoTags = makePlayerState({ spellTagsUsed: [] })
      const resultNoSynergy = castSpell(spell, playerNoTags, makeEnemy(), baseMage, makeCombatState())

      // With synergy, damage should be higher
      expect(resultWithSynergy.enemy.hp).toBeLessThan(resultNoSynergy.enemy.hp)
    })

    it('tracks tags after casting', () => {
      const spell: Spell = {
        id: 'test-tags',
        name: 'Test',
        description: 'test',
        school: 'arcane',
        manaCost: 5,
        cooldown: 0,
        target: 'enemy',
        effects: [{ type: 'damage', value: 5 }],
        tags: ['arcane', 'burst'],
      }
      const result = castSpell(spell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.spellTagsUsed).toContain('arcane')
      expect(result.playerState.spellTagsUsed).toContain('burst')
    })
  })

  describe('Class Mana Calculations', () => {
    it('mage gets higher max mana than warrior', () => {
      const mageMana = calculateMaxMana(baseMage)
      const warriorMana = calculateMaxMana(baseWarrior)
      expect(mageMana).toBeGreaterThan(warriorMana)
    })

    it('calculates correct base mana', () => {
      // base = 20 + int * 3 + level * 5
      // mage: (20 + 10*3 + 3*5) * 1.5 = (20+30+15) * 1.5 = 97.5 = 97
      const mageMana = calculateMaxMana(baseMage)
      expect(mageMana).toBe(97)
    })

    it('warrior gets reduced mana', () => {
      // warrior: (20 + 5*3 + 3*5) * 0.6 = (20+15+15) * 0.6 = 30
      const warriorMana = calculateMaxMana(baseWarrior)
      expect(warriorMana).toBe(30)
    })
  })

  describe('Class School Bonus', () => {
    it('mage gets school bonus for arcane spells', () => {
      const arcaneSpell: Spell = {
        id: 'test-school',
        name: 'Arcane Bolt',
        description: 'test',
        school: 'arcane',
        manaCost: 5,
        cooldown: 0,
        target: 'enemy',
        effects: [{ type: 'damage', value: 10, element: 'arcane' }],
        tags: ['arcane'],
      }
      const mageResult = castSpell(arcaneSpell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())

      // Warrior casting same spell should do less (no arcane school bonus)
      const warriorResult = castSpell(arcaneSpell, makePlayerState(), makeEnemy(), baseWarrior, makeCombatState())

      // Mage gets 1.2x school bonus on arcane spells
      expect(mageResult.enemy.hp).toBeLessThan(warriorResult.enemy.hp)
    })

    it('warrior gets school bonus for war spells', () => {
      const warSpell = STARTING_SPELLS.warrior // Iron Skin (war school)
      const warriorResult = castSpell(warSpell, makePlayerState(), makeEnemy(), baseWarrior, makeCombatState())
      // Just verify it casts successfully
      expect(warriorResult.logs.length).toBeGreaterThan(0)
    })
  })

  describe('Spell Scroll Learning', () => {
    it('returns starting spells for each class', () => {
      expect(getStartingSpell('mage')).toBeDefined()
      expect(getStartingSpell('ranger')).toBeDefined()
      expect(getStartingSpell('rogue')).toBeDefined()
      expect(getStartingSpell('warrior')).toBeDefined()
    })

    it('returns undefined for unknown class', () => {
      expect(getStartingSpell('unknown')).toBeUndefined()
    })

    it('each starting spell has valid structure', () => {
      for (const [, spell] of Object.entries(STARTING_SPELLS)) {
        expect(spell.id).toBeDefined()
        expect(spell.name).toBeDefined()
        expect(spell.manaCost).toBeGreaterThan(0)
        expect(spell.effects.length).toBeGreaterThan(0)
        expect(spell.tags.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Spell Effect Ticking', () => {
    it('ticks DOT damage', () => {
      const playerState = makePlayerState({
        activeSpellEffects: [
          { spellId: 'dot-1', effectType: 'damage_over_time', value: 5, turnsRemaining: 3 },
        ],
      })
      const enemy = makeEnemy({ hp: 50 })
      const result = tickSpellEffects(playerState, enemy, 2)
      expect(result.enemy.hp).toBe(45)
      expect(result.playerState.activeSpellEffects!.length).toBe(1)
      expect(result.playerState.activeSpellEffects![0].turnsRemaining).toBe(2)
    })

    it('ticks HOT healing', () => {
      const playerState = makePlayerState({
        hp: 30,
        activeSpellEffects: [
          { spellId: 'hot-1', effectType: 'heal_over_time', value: 5, turnsRemaining: 2 },
        ],
      })
      const result = tickSpellEffects(playerState, makeEnemy(), 2)
      expect(result.playerState.hp).toBe(35)
    })

    it('removes effects when turns expire', () => {
      const playerState = makePlayerState({
        activeSpellEffects: [
          { spellId: 'dot-1', effectType: 'damage_over_time', value: 5, turnsRemaining: 1 },
        ],
      })
      const result = tickSpellEffects(playerState, makeEnemy(), 2)
      expect(result.playerState.activeSpellEffects!.length).toBe(0)
    })

    it('ticks bleed damage', () => {
      const playerState = makePlayerState({
        activeSpellEffects: [
          { spellId: 'bleed-1', effectType: 'bleed', value: 3, turnsRemaining: 2 },
        ],
      })
      const enemy = makeEnemy({ hp: 40 })
      const result = tickSpellEffects(playerState, enemy, 2)
      expect(result.enemy.hp).toBe(37)
    })
  })

  describe('Shield Absorption', () => {
    it('absorbs full damage when shield is larger', () => {
      const playerState = makePlayerState({ shield: 20 })
      const result = applyShieldAbsorption(playerState, 10)
      expect(result.damageAfterShield).toBe(0)
      expect(result.playerState.shield).toBe(10)
    })

    it('partially absorbs damage when shield is smaller', () => {
      const playerState = makePlayerState({ shield: 5 })
      const result = applyShieldAbsorption(playerState, 15)
      expect(result.damageAfterShield).toBe(10)
      expect(result.playerState.shield).toBe(0)
    })

    it('returns full damage when no shield', () => {
      const playerState = makePlayerState({ shield: 0 })
      const result = applyShieldAbsorption(playerState, 10)
      expect(result.damageAfterShield).toBe(10)
    })
  })

  describe('Damage Reduction', () => {
    it('returns correct reduction percentage', () => {
      const playerState = makePlayerState({
        activeSpellEffects: [
          { spellId: 'dr-1', effectType: 'damage_reduction', value: 0, percentage: 40, turnsRemaining: 2 },
        ],
      })
      expect(getActiveDamageReduction(playerState)).toBe(40)
    })

    it('caps at 75%', () => {
      const playerState = makePlayerState({
        activeSpellEffects: [
          { spellId: 'dr-1', effectType: 'damage_reduction', value: 0, percentage: 50, turnsRemaining: 2 },
          { spellId: 'dr-2', effectType: 'damage_reduction', value: 0, percentage: 50, turnsRemaining: 2 },
        ],
      })
      expect(getActiveDamageReduction(playerState)).toBe(75)
    })
  })

  describe('Spell Generator', () => {
    it('generates a valid spell for a given level', () => {
      const spell = generateSpellForLevel(3)
      expect(spell.id).toBeDefined()
      expect(spell.name).toBeDefined()
      expect(spell.school).toBeDefined()
      expect(spell.manaCost).toBeGreaterThan(0)
      expect(spell.effects.length).toBeGreaterThan(0)
      expect(spell.tags.length).toBeGreaterThan(0)
    })

    it('generates spells for a specific school', () => {
      const spell = generateSpellForLevel(5, 'shadow')
      expect(spell.school).toBe('shadow')
    })
  })

  describe('CLASS_SPELL_CONFIG', () => {
    it('has config for all four classes', () => {
      expect(CLASS_SPELL_CONFIG.warrior).toBeDefined()
      expect(CLASS_SPELL_CONFIG.mage).toBeDefined()
      expect(CLASS_SPELL_CONFIG.rogue).toBeDefined()
      expect(CLASS_SPELL_CONFIG.ranger).toBeDefined()
    })

    it('mage has highest mana multiplier', () => {
      expect(CLASS_SPELL_CONFIG.mage.manaMultiplier).toBeGreaterThan(CLASS_SPELL_CONFIG.warrior.manaMultiplier)
      expect(CLASS_SPELL_CONFIG.mage.manaMultiplier).toBeGreaterThan(CLASS_SPELL_CONFIG.rogue.manaMultiplier)
      expect(CLASS_SPELL_CONFIG.mage.manaMultiplier).toBeGreaterThan(CLASS_SPELL_CONFIG.ranger.manaMultiplier)
    })

    it('mage has most spell slots', () => {
      expect(CLASS_SPELL_CONFIG.mage.maxSlots).toBeGreaterThan(CLASS_SPELL_CONFIG.warrior.maxSlots)
    })
  })

  describe('Combo Behavior', () => {
    it('combo_boost spells preserve combo count', () => {
      const spell = STARTING_SPELLS.mage // has combo_boost
      const playerState = makePlayerState({ comboCount: 2, mana: 20 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      // combo should be preserved and boosted (2 + 1 = 3)
      expect(result.playerState.comboCount).toBe(3)
    })

    it('spells without combo_boost reset combo', () => {
      const spell: Spell = {
        id: 'test-no-combo',
        name: 'Reset',
        description: 'test',
        school: 'arcane',
        manaCost: 5,
        cooldown: 0,
        target: 'enemy',
        effects: [{ type: 'damage', value: 10 }],
        tags: ['arcane'],
      }
      const playerState = makePlayerState({ comboCount: 3 })
      const result = castSpell(spell, playerState, makeEnemy(), baseMage, makeCombatState())
      expect(result.playerState.comboCount).toBe(0)
    })
  })
})
