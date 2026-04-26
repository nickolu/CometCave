import { describe, expect, it } from 'vitest'

import { checkQuestProgress, generateTimedQuest } from '@/app/tap-tap-adventure/lib/questGenerator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

const baseChar: FantasyCharacter = {
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 2,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 200,
  status: 'active',
  strength: 7,
  intelligence: 6,
  luck: 6,
  charisma: 6,
  hp: 100,
  maxHp: 100,
  inventory: [],
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  factionReputations: {},
}

describe('Quest Generator', () => {
  describe('generateTimedQuest', () => {
    it('generates a quest with valid fields', () => {
      const quest = generateTimedQuest(baseChar)
      expect(quest.id).toBeTruthy()
      expect(quest.title).toBeTruthy()
      expect(quest.description).toBeTruthy()
      expect(quest.status).toBe('active')
      expect(['reach_distance', 'collect_gold', 'win_combat', 'gain_reputation', 'explore_landmarks', 'survive_combats', 'reach_level', 'hoard_items', 'visit_region']).toContain(quest.type)
      expect(quest.target).toBeGreaterThan(0)
      expect(quest.deadlineDay).toBeGreaterThan(quest.startDay)
      expect(quest.rewards.gold).toBeGreaterThan(0)
    })

    it('sets deadline in the future', () => {
      const quest = generateTimedQuest(baseChar)
      expect(quest.deadlineDay).toBeGreaterThan(quest.startDay)
    })
  })

  describe('checkQuestProgress', () => {
    it('marks reach_distance quest as completed when target reached', () => {
      const quest = generateTimedQuest(baseChar)
      const distanceQuest = { ...quest, type: 'reach_distance' as const, target: 250 }
      const advancedChar = { ...baseChar, distance: 260 }
      const result = checkQuestProgress(distanceQuest, advancedChar)
      expect(result.status).toBe('completed')
    })

    it('marks collect_gold quest as completed', () => {
      const quest = generateTimedQuest(baseChar)
      const goldQuest = { ...quest, type: 'collect_gold' as const, target: 100 }
      const richChar = { ...baseChar, gold: 150 }
      const result = checkQuestProgress(goldQuest, richChar)
      expect(result.status).toBe('completed')
    })

    it('marks win_combat quest as completed when combatWon is true', () => {
      const quest = generateTimedQuest(baseChar)
      const combatQuest = { ...quest, type: 'win_combat' as const, target: 1 }
      const result = checkQuestProgress(combatQuest, baseChar, true)
      expect(result.status).toBe('completed')
    })

    it('does not complete win_combat quest without combat', () => {
      const quest = generateTimedQuest(baseChar)
      const combatQuest = { ...quest, type: 'win_combat' as const, target: 1 }
      const result = checkQuestProgress(combatQuest, baseChar, false)
      expect(result.status).toBe('active')
    })

    it('marks quest as failed when deadline passes', () => {
      const quest = generateTimedQuest(baseChar)
      const expiredQuest = { ...quest, deadlineDay: 1 }
      // Character at distance 200 is on day 5 (200/50 + 1)
      const result = checkQuestProgress(expiredQuest, baseChar)
      expect(result.status).toBe('failed')
    })

    it('does not change completed quests', () => {
      const quest = generateTimedQuest(baseChar)
      const completedQuest = { ...quest, status: 'completed' as const }
      const result = checkQuestProgress(completedQuest, baseChar)
      expect(result.status).toBe('completed')
    })

    it('marks gain_reputation quest as completed', () => {
      const quest = generateTimedQuest(baseChar)
      const repQuest = { ...quest, type: 'gain_reputation' as const, target: 15 }
      const repChar = { ...baseChar, reputation: 20 }
      const result = checkQuestProgress(repQuest, repChar)
      expect(result.status).toBe('completed')
    })

    it('marks explore_landmarks quest as completed when landmarks explored', () => {
      const quest = generateTimedQuest(baseChar)
      const exploreQuest = { ...quest, type: 'explore_landmarks' as const, target: 2, startValue: 0 }
      const explorerChar = {
        ...baseChar,
        landmarkState: {
          regionId: 'test',
          landmarks: [
            { templateId: 't1', name: 'Ruins', type: 'ruins', description: 'Old ruins', icon: '🏛️', hasShop: false, encounterPrompt: '', distanceFromEntry: 10, hidden: false, explored: true },
            { templateId: 't2', name: 'Tower', type: 'tower', description: 'A tower', icon: '🗼', hasShop: false, encounterPrompt: '', distanceFromEntry: 20, hidden: false, explored: true },
          ],
          entryDistance: 0,
          nextLandmarkIndex: 2,
          exploring: false,
          explorationDepth: 0,
          positionInRegion: 50,
          activeTargetIndex: 0,
          regionLength: 200,
        },
      }
      const result = checkQuestProgress(exploreQuest, explorerChar as any)
      expect(result.status).toBe('completed')
    })

    it('tracks survive_combats progress incrementally', () => {
      const quest = generateTimedQuest(baseChar)
      const combatQuest = { ...quest, type: 'survive_combats' as const, target: 3, startValue: 0 }
      // First win
      const result1 = checkQuestProgress(combatQuest, baseChar, true)
      expect(result1.status).toBe('active')
      expect(result1.startValue).toBe(1)
      // Second win
      const result2 = checkQuestProgress(result1, baseChar, true)
      expect(result2.status).toBe('active')
      expect(result2.startValue).toBe(2)
      // Third win — complete
      const result3 = checkQuestProgress(result2, baseChar, true)
      expect(result3.status).toBe('completed')
    })

    it('marks reach_level quest as completed', () => {
      const quest = generateTimedQuest(baseChar)
      const levelQuest = { ...quest, type: 'reach_level' as const, target: 5, startValue: 2 }
      const leveledChar = { ...baseChar, level: 5 }
      const result = checkQuestProgress(levelQuest, leveledChar)
      expect(result.status).toBe('completed')
    })

    it('marks hoard_items quest as completed', () => {
      const quest = generateTimedQuest(baseChar)
      const hoardQuest = { ...quest, type: 'hoard_items' as const, target: 3, startValue: 0 }
      const itemChar = { ...baseChar, inventory: [
        { id: '1', name: 'Sword', description: 'A sword', quantity: 1 },
        { id: '2', name: 'Shield', description: 'A shield', quantity: 1 },
        { id: '3', name: 'Potion', description: 'A potion', quantity: 1 },
      ]}
      const result = checkQuestProgress(hoardQuest, itemChar as any)
      expect(result.status).toBe('completed')
    })

    it('marks visit_region quest as completed', () => {
      const quest = generateTimedQuest(baseChar)
      const regionQuest = { ...quest, type: 'visit_region' as const, target: 2, startValue: 1 }
      const traveledChar = { ...baseChar, visitedRegions: ['green_meadows', 'dark_forest'] }
      const result = checkQuestProgress(regionQuest, traveledChar)
      expect(result.status).toBe('completed')
    })
  })
})
