import { describe, expect, it } from 'vitest'

import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'
import { checkAchievements, AchievementEvent } from '@/app/tap-tap-adventure/lib/achievementTracker'
import { PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { GameState } from '@/app/tap-tap-adventure/models/types'

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
  bounty: 0,
  mountRoster: [],
  mailbox: [],
  party: [],
}

const baseGameState: GameState = {
  player: { id: 'p1', settings: {} },
  selectedCharacterId: '1',
  characters: [baseChar],
  locations: [],
  storyEvents: [],
  decisionPoint: null,
  combatState: null,
  shopState: null,
  activeQuest: null,
  genericMessage: null,
  achievements: [],
  legacyHeirlooms: [],
  dailyReward: null,
  dailyChallenges: null,
  metaProgression: null,
  runSummary: null,
  pendingLootCelebration: null,
  newItemIds: [],
}

describe('Achievement Definitions', () => {
  it('should have at least 20 achievements defined', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20)
  })

  it('should have unique IDs', () => {
    const ids = ACHIEVEMENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should cover all categories', () => {
    const categories = new Set(ACHIEVEMENTS.map(a => a.category))
    expect(categories.has('travel')).toBe(true)
    expect(categories.has('combat')).toBe(true)
    expect(categories.has('collection')).toBe(true)
    expect(categories.has('progression')).toBe(true)
    expect(categories.has('special')).toBe(true)
  })
})

describe('Travel Achievements', () => {
  it('should unlock First Steps at distance 10', () => {
    const char = { ...baseChar, distance: 10 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('travel_first_steps')
  })

  it('should not unlock First Steps at distance 9', () => {
    const char = { ...baseChar, distance: 9 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).not.toContain('travel_first_steps')
  })

  it('should unlock multiple travel achievements at high distance', () => {
    const char = { ...baseChar, distance: 500 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('travel_first_steps')
    expect(newlyCompleted).toContain('travel_wanderer')
    expect(newlyCompleted).toContain('travel_explorer')
  })

  it('should track progress for incomplete travel achievements', () => {
    const char = { ...baseChar, distance: 50 }
    const { achievements } = checkAchievements(char, baseGameState, [])
    const wanderer = achievements.find(a => a.achievementId === 'travel_wanderer')
    expect(wanderer?.progress).toBe(50)
    expect(wanderer?.completed).toBe(false)
  })
})

describe('Combat Achievements', () => {
  it('should unlock First Blood on combat win', () => {
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 80, maxHp: 100, isBoss: false }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).toContain('combat_first_blood')
  })

  it('should track cumulative combat wins', () => {
    const existingAchievements: PlayerAchievement[] = [
      { achievementId: 'combat_first_blood', progress: 1, completed: true, completedAt: '2024-01-01' },
      { achievementId: 'combat_warriors_path', progress: 5, completed: false },
      { achievementId: 'combat_slayer', progress: 5, completed: false },
    ]
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 80, maxHp: 100, isBoss: false }
    const { achievements } = checkAchievements(baseChar, baseGameState, existingAchievements, event)
    const warriorsPath = achievements.find(a => a.achievementId === 'combat_warriors_path')
    expect(warriorsPath?.progress).toBe(6)
  })

  it('should unlock Boss Killer on boss defeat', () => {
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 80, maxHp: 100, isBoss: true }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).toContain('combat_boss_killer')
  })

  it('should not unlock Boss Killer on non-boss defeat', () => {
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 80, maxHp: 100, isBoss: false }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).not.toContain('combat_boss_killer')
  })

  it('should unlock Untouchable when winning at full HP', () => {
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 100, maxHp: 100, isBoss: false }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).toContain('combat_untouchable')
  })
})

describe('Collection Achievements', () => {
  it('should unlock Collector with 5 items', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      description: 'Test',
      type: 'consumable' as const,
      quantity: 1,
    }))
    const char = { ...baseChar, inventory: items }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('collection_collector')
  })

  it('should not count deleted items for Collector', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      description: 'Test',
      type: 'consumable' as const,
      quantity: 1,
      status: i < 3 ? ('active' as const) : ('deleted' as const),
    }))
    const char = { ...baseChar, inventory: items }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).not.toContain('collection_collector')
  })

  it('should unlock Spell Scholar with 3 spells', () => {
    const spells = Array.from({ length: 3 }, (_, i) => ({
      id: `spell-${i}`,
      name: `Spell ${i}`,
      description: 'Test',
      manaCost: 10,
      school: 'arcane' as const,
      target: 'enemy' as const,
      effects: [],
      cooldown: 1,
      tags: [],
    }))
    const char = { ...baseChar, spellbook: spells }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('collection_spell_scholar')
  })

  it('should unlock Well Equipped with all 3 slots filled', () => {
    const makeItem = (id: string) => ({
      id,
      name: id,
      description: 'Test',
      type: 'equipment' as const,
      quantity: 1,
    })
    const char = {
      ...baseChar,
      equipment: {
        weapon: makeItem('w1'),
        armor: makeItem('a1'),
        accessory: makeItem('acc1'),
      },
    }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('collection_well_equipped')
  })
})

describe('Progression Achievements', () => {
  it('should unlock Level 2 at level 2', () => {
    const char = { ...baseChar, level: 2 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('progression_level_2')
  })

  it('should unlock Rich at 100 gold', () => {
    const char = { ...baseChar, gold: 100 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('progression_rich')
  })

  it('should unlock Famous at 50 reputation', () => {
    const char = { ...baseChar, reputation: 50 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, [])
    expect(newlyCompleted).toContain('progression_famous')
  })
})

describe('Special Achievements', () => {
  it('should unlock Survivor when winning combat with < 5 HP', () => {
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 3, maxHp: 100, isBoss: false }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).toContain('special_survivor')
  })

  it('should not unlock Survivor when HP is 0', () => {
    const event: AchievementEvent = { type: 'combat_win', hpAfterCombat: 0, maxHp: 100, isBoss: false }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).not.toContain('special_survivor')
  })

  it('should track shop purchases cumulatively', () => {
    const existing: PlayerAchievement[] = [
      { achievementId: 'special_shopkeeper_friend', progress: 9, completed: false },
    ]
    const event: AchievementEvent = { type: 'shop_purchase' }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, existing, event)
    expect(newlyCompleted).toContain('special_shopkeeper_friend')
  })

  it('should unlock Death Defier on death event', () => {
    const event: AchievementEvent = { type: 'death' }
    const { newlyCompleted } = checkAchievements(baseChar, baseGameState, [], event)
    expect(newlyCompleted).toContain('special_death_defier')
  })
})

describe('Completion Detection', () => {
  it('should not re-trigger completed achievements', () => {
    const existingAchievements: PlayerAchievement[] = [
      { achievementId: 'travel_first_steps', progress: 10, completed: true, completedAt: '2024-01-01' },
    ]
    const char = { ...baseChar, distance: 20 }
    const { newlyCompleted } = checkAchievements(char, baseGameState, existingAchievements)
    expect(newlyCompleted).not.toContain('travel_first_steps')
  })

  it('should preserve completedAt date for already completed achievements', () => {
    const existingAchievements: PlayerAchievement[] = [
      { achievementId: 'travel_first_steps', progress: 10, completed: true, completedAt: '2024-01-01T00:00:00.000Z' },
    ]
    const char = { ...baseChar, distance: 20 }
    const { achievements } = checkAchievements(char, baseGameState, existingAchievements)
    const firstSteps = achievements.find(a => a.achievementId === 'travel_first_steps')
    expect(firstSteps?.completed).toBe(true)
  })

  it('should set completedAt when an achievement is newly completed', () => {
    const char = { ...baseChar, distance: 10 }
    const { achievements } = checkAchievements(char, baseGameState, [])
    const firstSteps = achievements.find(a => a.achievementId === 'travel_first_steps')
    expect(firstSteps?.completed).toBe(true)
    expect(firstSteps?.completedAt).toBeDefined()
  })
})

describe('Progress Tracking', () => {
  it('should update progress for all achievements even if not completed', () => {
    const char = { ...baseChar, distance: 5, level: 1, gold: 50, reputation: 25 }
    const { achievements } = checkAchievements(char, baseGameState, [])

    const firstSteps = achievements.find(a => a.achievementId === 'travel_first_steps')
    expect(firstSteps?.progress).toBe(5)

    const rich = achievements.find(a => a.achievementId === 'progression_rich')
    expect(rich?.progress).toBe(50)

    const famous = achievements.find(a => a.achievementId === 'progression_famous')
    expect(famous?.progress).toBe(25)
  })
})
