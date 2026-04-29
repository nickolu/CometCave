export const LIVES_START = 3
export const LIVES_MAX = 3
export const LIFE_REFUND_EVERY = 10

export const STREAK_TIERS = [
  { at: 0, mult: 1 },
  { at: 5, mult: 1.5 },
  { at: 10, mult: 2 },
  { at: 20, mult: 3 },
] as const

// Max points per question (before multiplier)
export const BASE_MAX_POINTS = 100

export function computeStreakMultiplier(streak: number): number {
  // Walk tiers in reverse, return first match
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].at) return STREAK_TIERS[i].mult
  }
  return 1
}

export function shouldRefundLife(newStreak: number, livesRemaining: number): boolean {
  return newStreak > 0 && newStreak % LIFE_REFUND_EVERY === 0 && livesRemaining < LIVES_MAX
}

export interface AnswerResult {
  correct: boolean
  points: number
  trailblazer: boolean
  livesRemaining: number
  currentStreak: number
  longestStreak: number
  score: number
  runOver: boolean
}

export function applyAnswer(params: {
  correct: boolean
  trailblazer: boolean
  elapsedMs: number
  mode: 'scored' | 'practice'
  prevLives: number
  prevStreak: number
  prevLongestStreak: number
  prevScore: number
}): AnswerResult {
  const { correct, trailblazer, mode, prevLives, prevStreak, prevLongestStreak, prevScore } = params

  let lives = prevLives
  let streak = prevStreak
  let longestStreak = prevLongestStreak
  let points = 0

  if (correct) {
    streak += 1
    longestStreak = Math.max(longestStreak, streak)
    const mult = computeStreakMultiplier(streak)
    points = Math.round(BASE_MAX_POINTS * mult)
    // Life refund
    if (shouldRefundLife(streak, lives)) {
      lives = Math.min(lives + 1, LIVES_MAX)
    }
  } else {
    streak = 0
    if (mode === 'scored') {
      lives -= 1
    }
  }

  const score = prevScore + points
  const runOver = mode === 'scored' && lives <= 0

  return { correct, points, trailblazer, livesRemaining: lives, currentStreak: streak, longestStreak, score, runOver }
}
