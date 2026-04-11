import { describe, expect, it, vi } from 'vitest'

import {
  MOUNT_DEFINITIONS,
  getMountById,
  getMountsByRarity,
  getRandomMount,
} from '@/app/tap-tap-adventure/config/mounts'
import { initializePlayerCombatState, getCombatRewards } from '@/app/tap-tap-adventure/lib/combatEngine'
import { applyLevelFromDistance } from '@/app/tap-tap-adventure/lib/leveling'
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
