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
  hp: 100,
  maxHp: 100,
  inventory: [],
  deathCount: 0,
}

describe('Quest Generator', () => {
  describe('generateTimedQuest', () => {
    it('generates a quest with valid fields', () => {
      const quest = generateTimedQuest(baseChar)
      expect(quest.id).toBeTruthy()
      expect(quest.title).toBeTruthy()
      expect(quest.description).toBeTruthy()
      expect(quest.status).toBe('active')
      expect(['reach_distance', 'collect_gold', 'win_combat', 'gain_reputation']).toContain(quest.type)
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
  })
})
