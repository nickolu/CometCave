import { describe, expect, it } from 'vitest'

import { DAILY_REWARDS } from '@/app/tap-tap-adventure/config/dailyRewards'
import {
  canClaimDailyReward,
  claimDailyReward,
  getDailyReward,
  getTodayDateString,
} from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
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
  hp: 100,
  maxHp: 100,
  inventory: [],
  equipment: { weapon: null, armor: null, accessory: null },
  deathCount: 0,
  pendingStatPoints: 0,
  mana: 20,
  maxMana: 20,
  spellbook: [],
  classData: undefined,
}

function makeState(dailyReward: GameState['dailyReward'] = null): GameState {
  return {
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
    dailyReward,
  }
}

describe('Daily Rewards', () => {
  describe('canClaimDailyReward', () => {
    it('returns true when never claimed', () => {
      const state = makeState(null)
      expect(canClaimDailyReward(state)).toBe(true)
    })

    it('returns true when dailyReward exists but lastClaimedDate is null', () => {
      const state = makeState({ lastClaimedDate: null, streak: 0, totalDaysClaimed: 0 })
      expect(canClaimDailyReward(state)).toBe(true)
    })

    it('returns false if already claimed today', () => {
      const now = new Date('2026-04-12T14:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-12', streak: 0, totalDaysClaimed: 1 })
      expect(canClaimDailyReward(state, now)).toBe(false)
    })

    it('returns true if last claimed yesterday', () => {
      const now = new Date('2026-04-12T10:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-11', streak: 0, totalDaysClaimed: 1 })
      expect(canClaimDailyReward(state, now)).toBe(true)
    })
  })

  describe('getDailyReward', () => {
    it('returns the correct reward for each day', () => {
      for (let i = 0; i < 7; i++) {
        const reward = getDailyReward(i)
        expect(reward.day).toBe(DAILY_REWARDS[i].day)
      }
    })

    it('cycles back after 7 days', () => {
      expect(getDailyReward(7).day).toBe(DAILY_REWARDS[0].day)
      expect(getDailyReward(8).day).toBe(DAILY_REWARDS[1].day)
      expect(getDailyReward(14).day).toBe(DAILY_REWARDS[0].day)
    })
  })

  describe('claimDailyReward', () => {
    it('succeeds when never claimed before', () => {
      const now = new Date('2026-04-12T12:00:00')
      const state = makeState(null)
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      expect(result!.updatedState.dailyReward).toEqual({
        lastClaimedDate: '2026-04-12',
        streak: 0,
        totalDaysClaimed: 1,
      })
      // Day 1 reward is 10 gold
      expect(result!.goldAwarded).toBe(10)
      expect(result!.reward.day).toBe(1)
    })

    it('returns null when already claimed today', () => {
      const now = new Date('2026-04-12T15:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-12', streak: 0, totalDaysClaimed: 1 })
      const result = claimDailyReward(state, baseChar, now)
      expect(result).toBeNull()
    })

    it('increments streak on consecutive days', () => {
      const now = new Date('2026-04-13T10:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-12', streak: 0, totalDaysClaimed: 1 })
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      expect(result!.updatedState.dailyReward!.streak).toBe(1)
      expect(result!.updatedState.dailyReward!.totalDaysClaimed).toBe(2)
      // Day 2 reward is a healing potion
      expect(result!.reward.day).toBe(2)
    })

    it('resets streak after missing a day', () => {
      const now = new Date('2026-04-15T10:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-12', streak: 2, totalDaysClaimed: 3 })
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      // Missed 2 days, so streak resets to 0
      expect(result!.updatedState.dailyReward!.streak).toBe(0)
      expect(result!.updatedState.dailyReward!.totalDaysClaimed).toBe(4)
      // Back to Day 1 reward
      expect(result!.reward.day).toBe(1)
    })

    it('reward cycle repeats after 7 days', () => {
      // Streak 6 (day 7) -> next consecutive day -> streak 7 which maps to day 1 again
      const now = new Date('2026-04-20T10:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-19', streak: 6, totalDaysClaimed: 7 })
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      expect(result!.updatedState.dailyReward!.streak).toBe(7)
      // streak 7 % 7 = 0, which is day 1
      expect(result!.reward.day).toBe(1)
      expect(result!.goldAwarded).toBe(10)
    })

    it('awards gold to the character', () => {
      const now = new Date('2026-04-12T12:00:00')
      const state = makeState(null)
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      const updatedChar = result!.updatedState.characters.find(c => c.id === '1')
      expect(updatedChar!.gold).toBe(baseChar.gold + 10)
    })

    it('awards reputation on day 5', () => {
      const now = new Date('2026-04-17T12:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-16', streak: 3, totalDaysClaimed: 4 })
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      // streak 4 = day 5
      expect(result!.reward.day).toBe(5)
      expect(result!.reputationAwarded).toBe(3)
      expect(result!.goldAwarded).toBe(30)
    })

    it('generates items for item-type rewards', () => {
      // streak 1 = day 2 (healing potion)
      const now = new Date('2026-04-13T12:00:00')
      const state = makeState({ lastClaimedDate: '2026-04-12', streak: 0, totalDaysClaimed: 1 })
      const result = claimDailyReward(state, baseChar, now)

      expect(result).not.toBeNull()
      expect(result!.items.length).toBeGreaterThan(0)
      expect(result!.items[0].name).toBe('Daily Healing Potion')
      expect(result!.items[0].effects?.heal).toBe(15)
    })
  })

  describe('getTodayDateString', () => {
    it('formats correctly', () => {
      const d = new Date('2026-01-05T15:30:00')
      expect(getTodayDateString(d)).toBe('2026-01-05')
    })
  })
})
