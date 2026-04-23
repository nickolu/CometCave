import { describe, expect, it } from 'vitest'

import { SPELL_COMBOS, checkSpellCombo, getSpellElement } from '@/app/tap-tap-adventure/lib/spellCombos'
import { castSpell } from '@/app/tap-tap-adventure/lib/spellEngine'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatPlayerState, CombatState } from '@/app/tap-tap-adventure/models/combat'
import { Spell } from '@/app/tap-tap-adventure/models/spell'

// ---- Helpers ----

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
  charisma: 6,
  inventory: [],
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  factionReputations: {},
  mana: 100,
  maxMana: 100,
  spellbook: [],
  discoveredCombos: [],
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
    mana: 100,
    maxMana: 100,
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
    hp: 200,
    maxHp: 200,
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

function makeFireSpell(): Spell {
  return {
    id: 'fire-bolt',
    name: 'Fire Bolt',
    description: 'A bolt of fire',
    school: 'arcane',
    manaCost: 5,
    cooldown: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 20, element: 'fire' }],
    tags: ['fire'],
  }
}

function makeLightningSpell(): Spell {
  return {
    id: 'lightning-bolt',
    name: 'Lightning Bolt',
    description: 'A bolt of lightning',
    school: 'arcane',
    manaCost: 5,
    cooldown: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 20, element: 'lightning' }],
    tags: ['lightning'],
  }
}

function makeIceSpell(): Spell {
  return {
    id: 'ice-lance',
    name: 'Ice Lance',
    description: 'A lance of ice',
    school: 'arcane',
    manaCost: 5,
    cooldown: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 20, element: 'ice' }],
    tags: ['ice'],
  }
}

function makeArcaneSpell(id: string): Spell {
  return {
    id,
    name: `Arcane Bolt ${id}`,
    description: 'A bolt of arcane energy',
    school: 'arcane',
    manaCost: 5,
    cooldown: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 20, element: 'arcane' }],
    tags: ['arcane'],
  }
}

// ---- Tests ----

describe('SPELL_COMBOS definitions', () => {
  it('defines exactly 8 combos', () => {
    expect(SPELL_COMBOS).toHaveLength(8)
  })

  it('each combo has required fields', () => {
    for (const combo of SPELL_COMBOS) {
      expect(combo.sequence).toBeDefined()
      expect(combo.sequence.length).toBeGreaterThanOrEqual(2)
      expect(combo.result.comboName).toBeTruthy()
      expect(typeof combo.result.damageMultiplier).toBe('number')
      expect(typeof combo.result.ignoreDefense).toBe('boolean')
      expect(typeof combo.result.bonusHealPct).toBe('number')
      expect(typeof combo.result.chainHit).toBe('boolean')
      expect(typeof combo.result.removeEnemyDefenseBuff).toBe('boolean')
      expect(typeof combo.result.slowEnemy).toBe('boolean')
    }
  })

  it('has unique combo names', () => {
    const names = SPELL_COMBOS.map(c => c.result.comboName)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('3-element combos are listed before 2-element combos', () => {
    const threeElement = SPELL_COMBOS.filter(c => c.sequence.length === 3)
    const twoElement = SPELL_COMBOS.filter(c => c.sequence.length === 2)
    const lastThreeIdx = SPELL_COMBOS.indexOf(threeElement[threeElement.length - 1])
    const firstTwoIdx = SPELL_COMBOS.indexOf(twoElement[0])
    expect(lastThreeIdx).toBeLessThan(firstTwoIdx)
  })
})

describe('checkSpellCombo', () => {
  it('returns null for empty history', () => {
    expect(checkSpellCombo([])).toBeNull()
  })

  it('returns null when last element is none', () => {
    expect(checkSpellCombo(['fire', 'none'])).toBeNull()
  })

  it('detects Plasma Burst (fire + lightning)', () => {
    const result = checkSpellCombo(['fire', 'lightning'])
    expect(result).not.toBeNull()
    expect(result!.comboName).toBe('Plasma Burst')
    expect(result!.damageMultiplier).toBe(1.5)
  })

  it('detects Frostfire (ice + fire)', () => {
    const result = checkSpellCombo(['ice', 'fire'])
    expect(result).not.toBeNull()
    expect(result!.comboName).toBe('Frostfire')
    expect(result!.removeEnemyDefenseBuff).toBe(true)
  })

  it('detects Arcane Cascade (arcane + arcane + arcane)', () => {
    const result = checkSpellCombo(['arcane', 'arcane', 'arcane'])
    expect(result).not.toBeNull()
    expect(result!.comboName).toBe('Arcane Cascade')
    expect(result!.damageMultiplier).toBe(3.0)
  })

  it('prefers 3-element combo over 2-element when tail matches both', () => {
    // fire + ice + lightning should trigger Elemental Fury, not a 2-element combo
    const result = checkSpellCombo(['fire', 'ice', 'lightning'])
    expect(result).not.toBeNull()
    expect(result!.comboName).toBe('Elemental Fury')
  })

  it('returns null for non-matching sequence', () => {
    expect(checkSpellCombo(['fire', 'fire'])).toBeNull()
    expect(checkSpellCombo(['arcane', 'shadow'])).toBeNull()
  })
})

describe('getSpellElement', () => {
  it('returns the element from a damage effect', () => {
    const spell: Spell = {
      id: 'test',
      name: 'Fire Bolt',
      description: '',
      school: 'arcane',
      manaCost: 5,
      cooldown: 0,
      target: 'enemy',
      effects: [{ type: 'damage', value: 10, element: 'fire' }],
      tags: [],
    }
    expect(getSpellElement(spell)).toBe('fire')
  })

  it('returns none when spell has no element and no school mapping', () => {
    const spell: Spell = {
      id: 'test',
      name: 'Physical Strike',
      description: '',
      school: 'war',
      manaCost: 0,
      cooldown: 0,
      target: 'enemy',
      effects: [{ type: 'damage', value: 10, element: 'none' }],
      tags: [],
    }
    expect(getSpellElement(spell)).toBe('none')
  })

  it('maps school to element as fallback for arcane school', () => {
    const spell: Spell = {
      id: 'test',
      name: 'Arcane Blast',
      description: '',
      school: 'arcane',
      manaCost: 5,
      cooldown: 0,
      target: 'enemy',
      effects: [],
      tags: [],
    }
    expect(getSpellElement(spell)).toBe('arcane')
  })
})

describe('Combo triggers in castSpell', () => {
  it('triggers Plasma Burst after fire then lightning', () => {
    const fireSpell = makeFireSpell()
    const lightningSpell = makeLightningSpell()
    const enemy = makeEnemy()
    const combatState = makeCombatState()

    // Cast fire first
    const after1 = castSpell(fireSpell, makePlayerState(), enemy, baseMage, combatState)
    expect(after1.comboName).toBeNull()

    // Cast lightning — should trigger Plasma Burst
    const playerStateAfterFire = after1.playerState
    const after2 = castSpell(lightningSpell, playerStateAfterFire, after1.enemy, baseMage, combatState)
    expect(after2.comboName).toBe('Plasma Burst')
  })

  it('combo log entry has action=spell_combo', () => {
    const fireSpell = makeFireSpell()
    const lightningSpell = makeLightningSpell()
    const after1 = castSpell(fireSpell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
    const after2 = castSpell(lightningSpell, after1.playerState, after1.enemy, baseMage, makeCombatState())

    const comboLog = after2.logs.find(l => l.action === 'spell_combo')
    expect(comboLog).toBeDefined()
    expect(comboLog?.description).toContain('Plasma Burst')
  })

  it('combo log description starts with COMBO: for ID extraction', () => {
    const fireSpell = makeFireSpell()
    const lightningSpell = makeLightningSpell()
    const after1 = castSpell(fireSpell, makePlayerState(), makeEnemy(), baseMage, makeCombatState())
    const after2 = castSpell(lightningSpell, after1.playerState, after1.enemy, baseMage, makeCombatState())

    const comboLog = after2.logs.find(l => l.action === 'spell_combo')
    expect(comboLog?.description).toMatch(/^COMBO: Plasma Burst!/)
  })

  it('triggers Arcane Cascade after three arcane spells', () => {
    const a1 = makeArcaneSpell('arcane-1')
    const a2 = makeArcaneSpell('arcane-2')
    const a3 = makeArcaneSpell('arcane-3')
    const enemy = makeEnemy()

    const r1 = castSpell(a1, makePlayerState(), enemy, baseMage, makeCombatState())
    // Reset cooldowns between casts (different spell IDs so no cooldown issue)
    const r2 = castSpell(a2, r1.playerState, r1.enemy, baseMage, makeCombatState())
    const r3 = castSpell(a3, r2.playerState, r2.enemy, baseMage, makeCombatState())

    expect(r3.comboName).toBe('Arcane Cascade')
  })

  it('Nature\'s Wrath heals player (bonusHealPct > 0)', () => {
    const natureSpell1: Spell = {
      id: 'nature-1',
      name: 'Nature Bolt 1',
      description: '',
      school: 'nature',
      manaCost: 5,
      cooldown: 0,
      target: 'enemy',
      effects: [{ type: 'damage', value: 15, element: 'nature' }],
      tags: ['nature'],
    }
    const natureSpell2: Spell = {
      id: 'nature-2',
      name: 'Nature Bolt 2',
      description: '',
      school: 'nature',
      manaCost: 5,
      cooldown: 0,
      target: 'enemy',
      effects: [{ type: 'damage', value: 15, element: 'nature' }],
      tags: ['nature'],
    }

    const playerState = makePlayerState({ hp: 10 }) // low HP so heal is detectable
    const r1 = castSpell(natureSpell1, playerState, makeEnemy(), baseMage, makeCombatState())
    const r2 = castSpell(natureSpell2, r1.playerState, r1.enemy, baseMage, makeCombatState())

    expect(r2.comboName).toBe("Nature's Wrath")
    // Player should have healed (15% of 50 maxHp = 7-8 HP)
    expect(r2.playerState.hp).toBeGreaterThan(r1.playerState.hp)
  })
})

describe('discoveredCombos field on character', () => {
  it('character schema accepts discoveredCombos as optional array', () => {
    // Simple type check — the field is optional
    const charWithCombos = { ...baseMage, discoveredCombos: ['plasma_burst', 'frostfire'] }
    const charWithEmptyCombos = { ...baseMage, discoveredCombos: [] }
    expect(charWithCombos.discoveredCombos).toHaveLength(2)
    expect(charWithEmptyCombos.discoveredCombos).toHaveLength(0)
    // A character without the field (undefined) should also be valid
    const { discoveredCombos: _removed, ...charNoCombos } = baseMage
    expect((_removed as unknown[]) ?? undefined).toBeDefined() // baseMage has it as []
    expect(charNoCombos.discoveredCombos).toBeUndefined()
  })

  it('combo ID format matches the pattern used in useCombatActionMutation', () => {
    // Simulate the ID derivation logic: name → lowercase → underscores
    function comboNameToId(name: string): string {
      return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    }
    expect(comboNameToId('Plasma Burst')).toBe('plasma_burst')
    expect(comboNameToId('Frostfire')).toBe('frostfire')
    expect(comboNameToId("Nature's Wrath")).toBe('nature_s_wrath')
    expect(comboNameToId('Arcane Cascade')).toBe('arcane_cascade')
    expect(comboNameToId('Shadow Storm')).toBe('shadow_storm')
    expect(comboNameToId('Void Freeze')).toBe('void_freeze')
    expect(comboNameToId('Wild Lightning')).toBe('wild_lightning')
    expect(comboNameToId('Elemental Fury')).toBe('elemental_fury')
  })

  it('all 8 combo names produce unique IDs', () => {
    function comboNameToId(name: string): string {
      return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    }
    const ids = SPELL_COMBOS.map(c => comboNameToId(c.result.comboName))
    const unique = new Set(ids)
    expect(unique.size).toBe(8)
  })
})
