import { describe, expect, it } from 'vitest'

import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { getUnlockedSkills, getSkillBonus, hasSkill, computeUnlockedSkillIds } from '@/app/tap-tap-adventure/lib/skillTracker'
import { initializePlayerCombatState, calculateFleeChance, getCombatRewards } from '@/app/tap-tap-adventure/lib/combatEngine'
import { calculateMaxHp, calculateMaxMana } from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 1,
  abilities: [],
  locationId: 'loc1',
  gold: 10,
  reputation: 5,
  distance: 0,
  status: 'active',
  strength: 5,
  intelligence: 3,
  luck: 2,
  charisma: 6,
  hp: 100,
  maxHp: 100,
  inventory: [],
  equipment: { weapon: null, armor: null, accessory: null },
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  factionReputations: {},
  mana: 20,
  maxMana: 20,
  spellbook: [],
  classData: undefined,
  activeMount: null,
  unlockedSkills: [],
}

function makeAchievement(id: string, progress: number, completed: boolean): PlayerAchievement {
  return { achievementId: id, progress, completed, completedAt: completed ? '2024-01-01' : undefined }
}

describe('Skill Definitions', () => {
  it('should have at least 15 skills defined', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(15)
  })

  it('should have unique IDs', () => {
    const ids = SKILLS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should cover all four categories', () => {
    const categories = new Set(SKILLS.map(s => s.category))
    expect(categories.has('combat')).toBe(true)
    expect(categories.has('survival')).toBe(true)
    expect(categories.has('utility')).toBe(true)
    expect(categories.has('exploration')).toBe(true)
  })
})

describe('Skill Unlocking', () => {
  it('should unlock Iron Fist after winning 10 combats', () => {
    const achievements: PlayerAchievement[] = [
      makeAchievement('combat_warriors_path', 10, true),
    ]
    const unlocked = getUnlockedSkills(baseChar, achievements)
    expect(unlocked.some(s => s.id === 'iron_fist')).toBe(true)
  })

  it('should not unlock Iron Fist with only 5 combat wins', () => {
    const achievements: PlayerAchievement[] = [
      makeAchievement('combat_warriors_path', 5, false),
    ]
    const unlocked = getUnlockedSkills(baseChar, achievements)
    expect(unlocked.some(s => s.id === 'iron_fist')).toBe(false)
  })

  it('should unlock Thick Skin when special_survivor achievement is completed', () => {
    const achievements: PlayerAchievement[] = [
      makeAchievement('special_survivor', 1, true),
    ]
    const unlocked = getUnlockedSkills(baseChar, achievements)
    expect(unlocked.some(s => s.id === 'thick_skin')).toBe(true)
  })

  it('should unlock Regeneration at 500 distance', () => {
    const char = { ...baseChar, distance: 500 }
    const unlocked = getUnlockedSkills(char, [])
    expect(unlocked.some(s => s.id === 'regeneration')).toBe(true)
  })

  it('should not unlock Regeneration at 499 distance', () => {
    const char = { ...baseChar, distance: 499 }
    const unlocked = getUnlockedSkills(char, [])
    expect(unlocked.some(s => s.id === 'regeneration')).toBe(false)
  })

  it('should unlock Mana Well at level 3', () => {
    const char = { ...baseChar, level: 3 }
    const unlocked = getUnlockedSkills(char, [])
    expect(unlocked.some(s => s.id === 'mana_well')).toBe(true)
  })

  it('should unlock Veteran at level 10', () => {
    const char = { ...baseChar, level: 10 }
    const unlocked = getUnlockedSkills(char, [])
    expect(unlocked.some(s => s.id === 'veteran')).toBe(true)
  })

  it('should unlock Haggler when shopkeeper_friend achievement is completed', () => {
    const achievements: PlayerAchievement[] = [
      makeAchievement('special_shopkeeper_friend', 10, true),
    ]
    const unlocked = getUnlockedSkills(baseChar, achievements)
    expect(unlocked.some(s => s.id === 'haggler')).toBe(true)
  })

  it('should unlock multiple skills when multiple requirements are met', () => {
    const char = { ...baseChar, level: 5, distance: 1000 }
    const unlocked = getUnlockedSkills(char, [])
    expect(unlocked.some(s => s.id === 'mana_well')).toBe(true)
    expect(unlocked.some(s => s.id === 'lucky_traveler')).toBe(true)
    expect(unlocked.some(s => s.id === 'regeneration')).toBe(true)
    expect(unlocked.some(s => s.id === 'pathfinder')).toBe(true)
  })
})

describe('getSkillBonus', () => {
  it('should return flat bonus for attack from Iron Fist', () => {
    const skills = SKILLS.filter(s => s.id === 'iron_fist')
    const bonus = getSkillBonus(skills, 'attack')
    expect(bonus.flat).toBe(2)
    expect(bonus.percentage).toBe(0)
  })

  it('should return percentage bonus for maxHp from Thick Skin', () => {
    const skills = SKILLS.filter(s => s.id === 'thick_skin')
    const bonus = getSkillBonus(skills, 'maxHp')
    expect(bonus.flat).toBe(0)
    expect(bonus.percentage).toBe(10)
  })

  it('should sum bonuses from multiple skills targeting the same stat', () => {
    // Veteran (+1 all_stats) affects 'all_stats' target
    const skills = SKILLS.filter(s => s.id === 'veteran')
    const bonus = getSkillBonus(skills, 'all_stats')
    expect(bonus.flat).toBe(1)
  })

  it('should return zero for unrelated targets', () => {
    const skills = SKILLS.filter(s => s.id === 'iron_fist')
    const bonus = getSkillBonus(skills, 'maxHp')
    expect(bonus.flat).toBe(0)
    expect(bonus.percentage).toBe(0)
  })
})

describe('hasSkill', () => {
  it('should return true when skill is in the list', () => {
    const skills = SKILLS.filter(s => s.id === 'iron_fist')
    expect(hasSkill(skills, 'iron_fist')).toBe(true)
  })

  it('should return false when skill is not in the list', () => {
    const skills = SKILLS.filter(s => s.id === 'iron_fist')
    expect(hasSkill(skills, 'thick_skin')).toBe(false)
  })
})

describe('computeUnlockedSkillIds', () => {
  it('should return array of skill IDs', () => {
    const char = { ...baseChar, level: 5, distance: 500 }
    const ids = computeUnlockedSkillIds(char, [])
    expect(ids).toContain('regeneration')
    expect(ids).toContain('mana_well')
    expect(ids).toContain('lucky_traveler')
  })
})

describe('Combat Integration - Attack Bonus', () => {
  it('should apply Iron Fist attack bonus in combat initialization', () => {
    const charWithoutSkill = { ...baseChar }
    const charWithSkill = { ...baseChar, unlockedSkills: ['iron_fist'] }
    const stateWithout = initializePlayerCombatState(charWithoutSkill)
    const stateWith = initializePlayerCombatState(charWithSkill)
    expect(stateWith.attack).toBe(stateWithout.attack + 2)
  })

  it('should apply Veteran all_stats bonus to attack and defense', () => {
    const charWithout = { ...baseChar }
    const charWith = { ...baseChar, unlockedSkills: ['veteran'] }
    const stateWithout = initializePlayerCombatState(charWithout)
    const stateWith = initializePlayerCombatState(charWith)
    expect(stateWith.attack).toBe(stateWithout.attack + 1)
    expect(stateWith.defense).toBe(stateWithout.defense + 1)
  })
})

describe('HP/Mana Bonus Calculations', () => {
  it('should apply Thick Skin +10% to max HP', () => {
    const charWithout = { ...baseChar }
    const charWith = { ...baseChar, unlockedSkills: ['thick_skin'] }
    const hpWithout = calculateMaxHp(charWithout)
    const hpWith = calculateMaxHp(charWith)
    expect(hpWith).toBe(Math.floor(hpWithout * 1.1))
  })

  it('should apply Mana Well +20% to max mana', () => {
    const charWithout = { ...baseChar }
    const charWith = { ...baseChar, unlockedSkills: ['mana_well'] }
    const manaWithout = calculateMaxMana(charWithout)
    const manaWith = calculateMaxMana(charWith)
    expect(manaWith).toBe(Math.floor(manaWithout * 1.2))
  })

  it('should apply Veteran all_stats bonus to HP calculation', () => {
    const charWithout = { ...baseChar }
    const charWith = { ...baseChar, unlockedSkills: ['veteran'] }
    const hpWithout = calculateMaxHp(charWithout)
    const hpWith = calculateMaxHp(charWith)
    // Veteran adds +1 strength, which adds +3 HP (strength * 3)
    expect(hpWith).toBe(hpWithout + 3)
  })
})

describe('Flee Chance Bonus', () => {
  it('should apply Quick Reflexes +10% flee chance', () => {
    const enemy = { name: 'Goblin', level: 1, hp: 10, maxHp: 10, attack: 3, defense: 1, goldReward: 5, statusEffects: [] }
    const charWithout = { ...baseChar }
    const charWith = { ...baseChar, unlockedSkills: ['quick_reflexes'] }
    const chanceWithout = calculateFleeChance(charWithout, enemy)
    const chanceWith = calculateFleeChance(charWith, enemy)
    expect(chanceWith).toBeCloseTo(chanceWithout + 0.1, 5)
  })
})

describe('Combat Rewards Bonuses', () => {
  it('should apply Gold Finder +25% gold bonus', () => {
    const enemy = {
      name: 'Goblin', level: 1, hp: 0, maxHp: 10, attack: 3, defense: 1,
      goldReward: 100, statusEffects: [],
    }
    const combatState = {
      enemy,
      playerState: initializePlayerCombatState(baseChar),
      turnNumber: 1,
      combatLog: [],
      status: 'victory' as const,
      enemyTelegraph: null,
      isBoss: false,
    }

    const charWithSkill = { ...baseChar, unlockedSkills: ['gold_finder'] }
    const rewards = getCombatRewards(combatState, charWithSkill)
    expect(rewards.gold).toBe(125) // 100 * 1.25
  })

  it('should not modify gold without Gold Finder skill', () => {
    const enemy = {
      name: 'Goblin', level: 1, hp: 0, maxHp: 10, attack: 3, defense: 1,
      goldReward: 100, statusEffects: [],
    }
    const combatState = {
      enemy,
      playerState: initializePlayerCombatState(baseChar),
      turnNumber: 1,
      combatLog: [],
      status: 'victory' as const,
      enemyTelegraph: null,
      isBoss: false,
    }

    const rewards = getCombatRewards(combatState, baseChar)
    expect(rewards.gold).toBe(100)
  })
})
