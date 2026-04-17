import { describe, expect, it } from 'vitest'

import {
  generateChallengesForDate,
  shouldRefreshChallenges,
  refreshChallenges,
  applyProgress,
  computeBonusReward,
  canClaimBonusReward,
} from '@/app/tap-tap-adventure/lib/dailyChallengeTracker'
import { DailyChallengesState } from '@/app/tap-tap-adventure/models/dailyChallenge'

const TODAY = '2026-04-17'
const YESTERDAY = '2026-04-16'

// Helper to build a minimal DailyChallengesState
function buildState(overrides: Partial<DailyChallengesState> = {}): DailyChallengesState {
  const challenges = generateChallengesForDate(TODAY, 1)
  return {
    date: TODAY,
    challenges,
    allCompletedClaimed: false,
    streak: 0,
    ...overrides,
  }
}

describe('generateChallengesForDate', () => {
  it('returns exactly 3 challenges', () => {
    const challenges = generateChallengesForDate(TODAY, 1)
    expect(challenges).toHaveLength(3)
  })

  it('all challenges have distinct types', () => {
    const challenges = generateChallengesForDate(TODAY, 1)
    const types = challenges.map(c => c.type)
    expect(new Set(types).size).toBe(3)
  })

  it('produces the same result for the same date and level (seeded determinism)', () => {
    const a = generateChallengesForDate(TODAY, 1)
    const b = generateChallengesForDate(TODAY, 1)
    expect(a.map(c => c.type)).toEqual(b.map(c => c.type))
    expect(a.map(c => c.target)).toEqual(b.map(c => c.target))
  })

  it('produces different challenges for different dates', () => {
    const a = generateChallengesForDate('2026-04-17', 1)
    const b = generateChallengesForDate('2026-04-18', 1)
    // Very unlikely to be exactly the same, but check at least the type order
    expect(a.map(c => c.type)).not.toEqual(b.map(c => c.type))
  })

  it('scales targets and rewards at bucket 0 (level 1)', () => {
    const challenges = generateChallengesForDate(TODAY, 1)
    const travelChallenge = challenges.find(c => c.type === 'travel_distance')
    if (travelChallenge) {
      expect(travelChallenge.target).toBe(50) // base: 50 + 0*30 = 50
      expect(travelChallenge.reward.gold).toBe(15) // base: 15 + 0*5 = 15
    }
    const winChallenge = challenges.find(c => c.type === 'win_combats')
    if (winChallenge) {
      expect(winChallenge.target).toBe(2) // base: 2 + 0*1 = 2
      expect(winChallenge.reward.gold).toBe(20) // base: 20 + 0*5 = 20
    }
  })

  it('scales targets and rewards at bucket 4 (level 21+)', () => {
    const challenges = generateChallengesForDate(TODAY, 21)
    const travelChallenge = challenges.find(c => c.type === 'travel_distance')
    if (travelChallenge) {
      expect(travelChallenge.target).toBe(170) // 50 + 4*30 = 170
      expect(travelChallenge.reward.gold).toBe(35) // 15 + 4*5 = 35
    }
    const winChallenge = challenges.find(c => c.type === 'win_combats')
    if (winChallenge) {
      expect(winChallenge.target).toBe(6) // 2 + 4*1 = 6
      expect(winChallenge.reward.gold).toBe(40) // 20 + 4*5 = 40
    }
  })

  it('craft_item always has target of 1 and 30 gold + 5 rep reward', () => {
    // Try a date that happens to include craft_item
    for (let day = 1; day <= 30; day++) {
      const date = `2026-04-${String(day).padStart(2, '0')}`
      const challenges = generateChallengesForDate(date, 10)
      const craft = challenges.find(c => c.type === 'craft_item')
      if (craft) {
        expect(craft.target).toBe(1)
        expect(craft.reward.gold).toBe(30)
        expect(craft.reward.reputation).toBe(5)
        break
      }
    }
  })
})

describe('shouldRefreshChallenges', () => {
  it('returns true when state is null', () => {
    expect(shouldRefreshChallenges(null, TODAY)).toBe(true)
  })

  it('returns true when state is undefined', () => {
    expect(shouldRefreshChallenges(undefined, TODAY)).toBe(true)
  })

  it('returns true when state date is different from today', () => {
    const state = buildState({ date: YESTERDAY })
    expect(shouldRefreshChallenges(state, TODAY)).toBe(true)
  })

  it('returns false when state date matches today', () => {
    const state = buildState({ date: TODAY })
    expect(shouldRefreshChallenges(state, TODAY)).toBe(false)
  })
})

describe('refreshChallenges', () => {
  it('generates 3 new challenges with todays date', () => {
    const result = refreshChallenges(null, TODAY, 1)
    expect(result.date).toBe(TODAY)
    expect(result.challenges).toHaveLength(3)
  })

  it('starts streak at 0 when previous state is null', () => {
    const result = refreshChallenges(null, TODAY, 1)
    expect(result.streak).toBe(0)
  })

  it('increments streak when all previous challenges were completed', () => {
    const prevChallenges = generateChallengesForDate(YESTERDAY, 1).map(c => ({
      ...c,
      progress: c.target,
      completed: true,
    }))
    const prevState: DailyChallengesState = {
      date: YESTERDAY,
      challenges: prevChallenges,
      allCompletedClaimed: true,
      streak: 2,
    }
    const result = refreshChallenges(prevState, TODAY, 1)
    expect(result.streak).toBe(3)
  })

  it('resets streak to 0 when previous day was not all completed', () => {
    const prevChallenges = generateChallengesForDate(YESTERDAY, 1)
    // Leave challenges uncompleted
    const prevState: DailyChallengesState = {
      date: YESTERDAY,
      challenges: prevChallenges,
      allCompletedClaimed: false,
      streak: 5,
    }
    const result = refreshChallenges(prevState, TODAY, 1)
    expect(result.streak).toBe(0)
  })

  it('resets allCompletedClaimed to false', () => {
    const result = refreshChallenges(null, TODAY, 1)
    expect(result.allCompletedClaimed).toBe(false)
  })
})

describe('applyProgress', () => {
  it('increments progress for a matching type', () => {
    const state = buildState()
    const targetType = state.challenges[0].type
    // Apply amount=1 which is always <= any challenge target
    const updated = applyProgress(state, targetType, 1)
    const challenge = updated.challenges.find(c => c.type === targetType)!
    expect(challenge.progress).toBe(1)
  })

  it('clamps progress at target', () => {
    const state = buildState()
    const firstChallenge = state.challenges[0]
    const updated = applyProgress(state, firstChallenge.type, firstChallenge.target + 100)
    const challenge = updated.challenges.find(c => c.type === firstChallenge.type)!
    expect(challenge.progress).toBe(firstChallenge.target)
    expect(challenge.completed).toBe(true)
  })

  it('marks challenge as completed when progress >= target', () => {
    const state = buildState()
    const firstChallenge = state.challenges[0]
    const updated = applyProgress(state, firstChallenge.type, firstChallenge.target)
    const challenge = updated.challenges.find(c => c.type === firstChallenge.type)!
    expect(challenge.completed).toBe(true)
  })

  it('skips already-completed challenges', () => {
    const state = buildState()
    const firstChallenge = state.challenges[0]
    // Complete it first
    const intermediate = applyProgress(state, firstChallenge.type, firstChallenge.target)
    // Apply more progress — should not change
    const updated = applyProgress(intermediate, firstChallenge.type, 999)
    const challenge = updated.challenges.find(c => c.type === firstChallenge.type)!
    expect(challenge.progress).toBe(firstChallenge.target) // still capped, not more
  })

  it('does not mutate the original state', () => {
    const state = buildState()
    const firstType = state.challenges[0].type
    const originalProgress = state.challenges[0].progress
    applyProgress(state, firstType, 10)
    expect(state.challenges[0].progress).toBe(originalProgress) // unchanged
  })

  it('does not affect challenges of a different type', () => {
    const state = buildState()
    // Get a type that is NOT the first challenge
    const otherType = (['travel_distance', 'earn_gold', 'win_combats', 'gain_reputation', 'craft_item'] as const)
      .find(t => t !== state.challenges[0].type && state.challenges.some(c => c.type === t))
    if (otherType) {
      const updated = applyProgress(state, state.challenges[0].type, 99)
      const otherChallenge = updated.challenges.find(c => c.type === otherType)!
      expect(otherChallenge.progress).toBe(0) // untouched
    }
  })
})

describe('computeBonusReward', () => {
  it('returns base values at streak 0', () => {
    const reward = computeBonusReward(0)
    expect(reward.gold).toBe(50)
    expect(reward.reputation).toBe(10)
  })

  it('scales correctly at streak 1', () => {
    const reward = computeBonusReward(1)
    expect(reward.gold).toBe(65)
    expect(reward.reputation).toBe(15)
  })

  it('caps at streak 10', () => {
    const reward10 = computeBonusReward(10)
    const reward20 = computeBonusReward(20)
    expect(reward10.gold).toBe(reward20.gold)
    expect(reward10.reputation).toBe(reward20.reputation)
  })

  it('returns max values at streak 10', () => {
    const reward = computeBonusReward(10)
    expect(reward.gold).toBe(50 + 10 * 15) // 200
    expect(reward.reputation).toBe(10 + 10 * 5) // 60
  })
})

describe('canClaimBonusReward', () => {
  it('returns true when all 3 completed and not yet claimed', () => {
    const challenges = generateChallengesForDate(TODAY, 1).map(c => ({
      ...c,
      progress: c.target,
      completed: true,
    }))
    const state: DailyChallengesState = {
      date: TODAY,
      challenges,
      allCompletedClaimed: false,
      streak: 0,
    }
    expect(canClaimBonusReward(state)).toBe(true)
  })

  it('returns false when already claimed', () => {
    const challenges = generateChallengesForDate(TODAY, 1).map(c => ({
      ...c,
      progress: c.target,
      completed: true,
    }))
    const state: DailyChallengesState = {
      date: TODAY,
      challenges,
      allCompletedClaimed: true,
      streak: 0,
    }
    expect(canClaimBonusReward(state)).toBe(false)
  })

  it('returns false when not all challenges are completed', () => {
    const challenges = generateChallengesForDate(TODAY, 1)
    // Only complete 2 of 3
    const partial = challenges.map((c, i) => ({
      ...c,
      progress: i < 2 ? c.target : 0,
      completed: i < 2,
    }))
    const state: DailyChallengesState = {
      date: TODAY,
      challenges: partial,
      allCompletedClaimed: false,
      streak: 0,
    }
    expect(canClaimBonusReward(state)).toBe(false)
  })
})
