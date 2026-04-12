import { DAILY_REWARDS, DailyReward } from '@/app/tap-tap-adventure/config/dailyRewards'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { GameState } from '@/app/tap-tap-adventure/models/types'
import { Item } from '@/app/tap-tap-adventure/models/item'

export interface DailyRewardState {
  lastClaimedDate: string | null // ISO date string (YYYY-MM-DD)
  streak: number // consecutive days claimed
  totalDaysClaimed: number
}

/**
 * Get today's date as YYYY-MM-DD in the local timezone.
 * Accepts an optional override for testing.
 */
export function getTodayDateString(now?: Date): string {
  const d = now ?? new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate the difference in calendar days between two YYYY-MM-DD strings.
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  const diffMs = b.getTime() - a.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check whether the player can claim their daily reward right now.
 */
export function canClaimDailyReward(state: GameState, now?: Date): boolean {
  const today = getTodayDateString(now)
  const dr = state.dailyReward

  if (!dr || !dr.lastClaimedDate) {
    return true // never claimed before
  }

  return dr.lastClaimedDate < today
}

/**
 * Get the reward definition for a given streak value.
 * Streak is 0-indexed internally but maps to day 1-7.
 */
export function getDailyReward(streak: number): DailyReward {
  const dayIndex = streak % DAILY_REWARDS.length
  return DAILY_REWARDS[dayIndex]
}

export interface ClaimResult {
  updatedState: GameState
  reward: DailyReward
  items: Item[]
  goldAwarded: number
  reputationAwarded: number
}

/**
 * Process claiming the daily reward. Returns updated state and reward details.
 */
export function claimDailyReward(
  state: GameState,
  character: FantasyCharacter,
  now?: Date
): ClaimResult | null {
  if (!canClaimDailyReward(state, now)) {
    return null
  }

  const today = getTodayDateString(now)
  const dr = state.dailyReward ?? { lastClaimedDate: null, streak: 0, totalDaysClaimed: 0 }

  // Determine new streak
  let newStreak: number
  if (!dr.lastClaimedDate) {
    newStreak = 0
  } else {
    const diff = daysBetween(dr.lastClaimedDate, today)
    if (diff === 1) {
      // Consecutive day
      newStreak = dr.streak + 1
    } else {
      // Missed a day (or more) — reset streak
      newStreak = 0
    }
  }

  const reward = getDailyReward(newStreak)

  // Generate items if the reward has them
  const items: Item[] = reward.generateItems ? reward.generateItems(character.level) : []
  const goldAwarded = reward.gold ?? 0
  const reputationAwarded = reward.reputation ?? 0

  // Build updated character
  const updatedCharacter: FantasyCharacter = {
    ...character,
    gold: character.gold + goldAwarded,
    reputation: character.reputation + reputationAwarded,
    inventory: [...character.inventory, ...items],
  }

  // Build updated state
  const updatedCharacters = state.characters.map(c =>
    c.id === character.id ? updatedCharacter : c
  )

  const updatedState: GameState = {
    ...state,
    characters: updatedCharacters,
    dailyReward: {
      lastClaimedDate: today,
      streak: newStreak,
      totalDaysClaimed: dr.totalDaysClaimed + 1,
    },
  }

  return {
    updatedState,
    reward,
    items,
    goldAwarded,
    reputationAwarded,
  }
}
