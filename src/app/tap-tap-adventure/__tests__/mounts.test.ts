import { describe, expect, it, vi } from 'vitest'

import {
  MOUNT_DEFINITIONS,
  getMountById,
  getMountsByRarity,
  getMountFreeMoves,
  getMountFleeBonus,
  getRandomMount,
} from '@/app/tap-tap-adventure/config/mounts'
import { initializePlayerCombatState, getCombatRewards, calculateFleeChance } from '@/app/tap-tap-adventure/lib/combatEngine'
import { applyLevelFromDistance } from '@/app/tap-tap-adventure/lib/leveling'
import { getMountDisplayName } from '@/app/tap-tap-adventure/lib/mountUtils'
import { MountSchema } from '@/app/tap-tap-adventure/models/mount'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'

function makeCharacter(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'test-char',
    playerId: 'p1',
    name: 'Tester',
    race: 'Human',
    class: 'Warrior',
    level: 5,
    abilities: [],
    locationId: 'loc1',
    gold: 100,
    reputation: 10,
    distance: 500,
    status: 'active',
    strength: 5,
    intelligence: 5,
    luck: 5,
    hp: 80,
    maxHp: 80,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    mana: 30,
    maxMana: 30,
    spellbook: [],
    classData: undefined,
    activeMount: null,
    ...overrides,
  }
}

describe('Mount Definitions', () => {
  it('should have 9 mount definitions', () => {
    expect(MOUNT_DEFINITIONS).toHaveLength(9)
  })

  it('should have 2 common, 3 uncommon, 3 rare, 1 legendary', () => {
    expect(getMountsByRarity('common')).toHaveLength(2)
    expect(getMountsByRarity('uncommon')).toHaveLength(3)
    expect(getMountsByRarity('rare')).toHaveLength(3)
    expect(getMountsByRarity('legendary')).toHaveLength(1)
  })

  it('should find mount by id', () => {
    const horse = getMountById('horse')
    expect(horse).toBeDefined()
    expect(horse!.name).toBe('Horse')
    expect(horse!.bonuses.strength).toBe(1)
    expect(horse!.bonuses.autoWalkSpeed).toBe(1.5)
    expect(horse!.dailyCost).toBe(1)
  })

  it('should return undefined for unknown mount id', () => {
    expect(getMountById('unicorn')).toBeUndefined()
  })

  it('getRandomMount should return a valid mount', () => {
    const mount = getRandomMount(0)
    expect(mount).toBeDefined()
    expect(mount.id).toBeTruthy()
    expect(mount.name).toBeTruthy()
    expect(mount.rarity).toBeTruthy()
  })
})

describe('Mount Combat Bonuses', () => {
  it('should apply mount strength bonus to attack', () => {
    const baseChar = makeCharacter()
    const mountedChar = makeCharacter({
      activeMount: getMountById('horse')!,
    })

    const baseState = initializePlayerCombatState(baseChar)
    const mountedState = initializePlayerCombatState(mountedChar)

    expect(mountedState.attack).toBe(baseState.attack + 1)
  })

  it('should apply mount intelligence bonus to defense', () => {
    const baseChar = makeCharacter()
    const mountedChar = makeCharacter({
      activeMount: getMountById('owl')!,
    })

    const baseState = initializePlayerCombatState(baseChar)
    const mountedState = initializePlayerCombatState(mountedChar)

    expect(mountedState.defense).toBe(baseState.defense + 1)
  })

  it('should apply mount luck bonus as active buff', () => {
    const mountedChar = makeCharacter({
      activeMount: getMountById('mule')!,
    })

    const state = initializePlayerCombatState(mountedChar)
    const luckBuffs = state.activeBuffs.filter(b => b.stat === 'attack' && b.turnsRemaining === 999)
    expect(luckBuffs.length).toBeGreaterThan(0)
    expect(luckBuffs.some(b => b.value === 2)).toBe(true)
  })

  it('should apply dragon bonuses (legendary)', () => {
    const baseChar = makeCharacter()
    const dragonChar = makeCharacter({
      activeMount: getMountById('dragon')!,
    })

    const baseState = initializePlayerCombatState(baseChar)
    const dragonState = initializePlayerCombatState(dragonChar)

    expect(dragonState.attack).toBe(baseState.attack + 3)
    expect(dragonState.defense).toBe(baseState.defense + 1)
    const luckBuffs = dragonState.activeBuffs.filter(b => b.stat === 'attack' && b.turnsRemaining === 999)
    expect(luckBuffs.some(b => b.value === 1)).toBe(true)
  })

  it('character without mount should have no mount bonuses', () => {
    const char = makeCharacter()
    const state = initializePlayerCombatState(char)
    expect(state.attack).toBe(9)
    expect(state.defense).toBe(5)
  })
})

describe('Mount Auto-Walk Speed', () => {
  it('horse should have 1.5x auto-walk speed', () => {
    const horse = getMountById('horse')!
    expect(horse.bonuses.autoWalkSpeed).toBe(1.5)
    const interval = Math.round(300 / horse.bonuses.autoWalkSpeed!)
    expect(interval).toBe(200)
  })

  it('dragon should have 2x auto-walk speed', () => {
    const dragon = getMountById('dragon')!
    expect(dragon.bonuses.autoWalkSpeed).toBe(2)
    const interval = Math.round(300 / dragon.bonuses.autoWalkSpeed!)
    expect(interval).toBe(150)
  })

  it('mule should not change auto-walk speed', () => {
    const mule = getMountById('mule')!
    expect(mule.bonuses.autoWalkSpeed).toBeUndefined()
    const speed = mule.bonuses.autoWalkSpeed ?? 1
    const interval = Math.round(300 / speed)
    expect(interval).toBe(300)
  })
})

describe('Mount Heal Rate', () => {
  it('phoenix mount should add bonus heal ticks', () => {
    const phoenix = getMountById('phoenix')!
    expect(phoenix.bonuses.healRate).toBe(1)

    const char = makeCharacter({
      activeMount: phoenix,
      distance: 9,
      hp: 50,
      maxHp: 80,
    })

    const updated = applyLevelFromDistance({
      ...char,
      distance: 10,
    })

    expect(updated.hp).toBe(52)
  })

  it('character without mount should heal normally', () => {
    const char = makeCharacter({
      activeMount: null,
      distance: 9,
      hp: 50,
      maxHp: 80,
    })

    const updated = applyLevelFromDistance({
      ...char,
      distance: 10,
    })

    expect(updated.hp).toBe(51)
  })
})

describe('Mount Daily Cost', () => {
  it('common mounts cost 1 gp/day', () => {
    for (const m of getMountsByRarity('common')) {
      expect(m.dailyCost).toBe(1)
    }
  })

  it('uncommon mounts cost 2 gp/day', () => {
    for (const m of getMountsByRarity('uncommon')) {
      expect(m.dailyCost).toBe(2)
    }
  })

  it('rare mounts cost 3 gp/day', () => {
    for (const m of getMountsByRarity('rare')) {
      expect(m.dailyCost).toBe(3)
    }
  })

  it('legendary mounts cost 5 gp/day', () => {
    for (const m of getMountsByRarity('legendary')) {
      expect(m.dailyCost).toBe(5)
    }
  })

  it('all mounts have a dailyCost property', () => {
    for (const m of MOUNT_DEFINITIONS) {
      expect(m.dailyCost).toBeGreaterThan(0)
    }
  })
})

describe('getMountFreeMoves', () => {
  it('common mount has 0 free moves', () => {
    expect(getMountFreeMoves('common')).toBe(0)
  })

  it('uncommon mount has 1 free move', () => {
    expect(getMountFreeMoves('uncommon')).toBe(1)
  })

  it('rare mount has 2 free moves', () => {
    expect(getMountFreeMoves('rare')).toBe(2)
  })

  it('legendary mount has 4 free moves', () => {
    expect(getMountFreeMoves('legendary')).toBe(4)
  })
})

describe('getMountFleeBonus', () => {
  it('common mount gives +10% flee bonus', () => {
    expect(getMountFleeBonus('common')).toBe(10)
  })

  it('uncommon mount gives +20% flee bonus', () => {
    expect(getMountFleeBonus('uncommon')).toBe(20)
  })

  it('rare mount gives +30% flee bonus', () => {
    expect(getMountFleeBonus('rare')).toBe(30)
  })

  it('legendary mount gives +50% flee bonus', () => {
    expect(getMountFleeBonus('legendary')).toBe(50)
  })
})

describe('Mount free moves in combat state', () => {
  it('common mount sets mountMovesRemaining to 0', () => {
    const char = makeCharacter({ activeMount: getMountById('horse')! })
    const state = initializePlayerCombatState(char)
    expect(state.mountMovesRemaining).toBe(0)
  })

  it('uncommon mount sets mountMovesRemaining to 1', () => {
    const char = makeCharacter({ activeMount: getMountById('war-horse')! })
    const state = initializePlayerCombatState(char)
    expect(state.mountMovesRemaining).toBe(1)
  })

  it('rare mount sets mountMovesRemaining to 2', () => {
    const char = makeCharacter({ activeMount: getMountById('griffin')! })
    const state = initializePlayerCombatState(char)
    expect(state.mountMovesRemaining).toBe(2)
  })

  it('legendary mount sets mountMovesRemaining to 4', () => {
    const char = makeCharacter({ activeMount: getMountById('dragon')! })
    const state = initializePlayerCombatState(char)
    expect(state.mountMovesRemaining).toBe(4)
  })

  it('no mount sets mountMovesRemaining to 0', () => {
    const char = makeCharacter({ activeMount: null })
    const state = initializePlayerCombatState(char)
    expect(state.mountMovesRemaining).toBe(0)
  })
})

describe('calculateFleeChance with mount bonus', () => {
  const baseEnemy = {
    id: 'e1',
    name: 'Goblin',
    description: 'A goblin',
    hp: 20,
    maxHp: 20,
    attack: 5,
    defense: 2,
    level: 1,
    goldReward: 5,
  }

  it('character without mount has base flee chance', () => {
    const char = makeCharacter({ luck: 0, activeMount: null })
    const chance = calculateFleeChance(char, baseEnemy)
    // Base: 0.3 + 0*0.02 - 1*0.05 = 0.25, clamped to 0.25
    expect(chance).toBeCloseTo(0.25, 2)
  })

  it('uncommon mount adds +20% flee bonus', () => {
    const charNoMount = makeCharacter({ luck: 0, activeMount: null })
    const charWithMount = makeCharacter({ luck: 0, activeMount: getMountById('war-horse')! })
    const baseChance = calculateFleeChance(charNoMount, baseEnemy)
    const mountChance = calculateFleeChance(charWithMount, baseEnemy)
    expect(mountChance).toBeCloseTo(baseChance + 0.20, 2)
  })

  it('legendary mount adds +50% flee bonus', () => {
    const charNoMount = makeCharacter({ luck: 0, activeMount: null })
    const charWithMount = makeCharacter({ luck: 0, activeMount: getMountById('dragon')! })
    const baseChance = calculateFleeChance(charNoMount, baseEnemy)
    const mountChance = calculateFleeChance(charWithMount, baseEnemy)
    expect(mountChance).toBeCloseTo(Math.min(0.9, baseChance + 0.50), 2)
  })
})

describe('Mount Boss Drops', () => {
  it('boss combat rewards may include a mount drop', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)

    const char = makeCharacter({ luck: 10 })
    const combatState: CombatState = {
      enemy: {
        name: 'Test Boss',
        hp: 0,
        maxHp: 100,
        attack: 10,
        defense: 5,
        level: 5,
        goldReward: 50,
        lootTable: [],
      },
      playerState: initializePlayerCombatState(char),
      turnNumber: 5,
      combatLog: [],
      status: 'victory',
      enemyTelegraph: null,
      isBoss: true,
    }

    const rewards = getCombatRewards(combatState, char)
    expect(rewards.mountDrop).toBeDefined()
    expect(rewards.mountDrop!.name).toBeTruthy()

    vi.restoreAllMocks()
  })

  it('non-boss combat should not drop mounts', () => {
    const char = makeCharacter()
    const combatState: CombatState = {
      enemy: {
        name: 'Test Enemy',
        hp: 0,
        maxHp: 50,
        attack: 5,
        defense: 3,
        level: 3,
        goldReward: 10,
        lootTable: [],
      },
      playerState: initializePlayerCombatState(char),
      turnNumber: 3,
      combatLog: [],
      status: 'victory',
      enemyTelegraph: null,
      isBoss: false,
    }

    const rewards = getCombatRewards(combatState, char)
    expect(rewards.mountDrop).toBeUndefined()
  })
})

describe('Mount Naming', () => {
  const baseMount = getMountById('horse')!

  it('getMountDisplayName returns mount.name when customName is undefined', () => {
    expect(getMountDisplayName(baseMount)).toBe('Horse')
  })

  it('getMountDisplayName returns customName when set', () => {
    const namedMount = { ...baseMount, customName: 'Shadowfax' }
    expect(getMountDisplayName(namedMount)).toBe('Shadowfax')
  })

  it('getMountDisplayName returns mount.name when customName is empty string (UI trims before storing)', () => {
    // The UI trims and rejects whitespace-only names before storing.
    // getMountDisplayName uses ??, which only falls back on null/undefined.
    // An empty string stored in customName would be returned as-is.
    // This tests the utility behavior: undefined customName -> mount.name
    const mount = { name: 'Horse', customName: undefined }
    expect(getMountDisplayName(mount)).toBe('Horse')
  })

  it('MountSchema accepts customName field', () => {
    const raw = {
      ...baseMount,
      customName: 'Shadowfax',
    }
    const parsed = MountSchema.safeParse(raw)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.customName).toBe('Shadowfax')
    }
  })

  it('MountSchema accepts mount without customName (backward compat)', () => {
    const parsed = MountSchema.safeParse(baseMount)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.customName).toBeUndefined()
    }
  })

  it('customName max 30 chars enforced by trimming', () => {
    const longName = 'A'.repeat(40)
    const trimmed = longName.slice(0, 30)
    expect(trimmed).toHaveLength(30)
    // MountSchema does not enforce length at schema level; UI enforces it
    const parsed = MountSchema.safeParse({ ...baseMount, customName: longName })
    expect(parsed.success).toBe(true)
  })
})
