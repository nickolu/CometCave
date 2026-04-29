import { describe, expect, it } from 'vitest'

import {
  BASE_MAX_POINTS,
  LIVES_MAX,
  LIVES_START,
  TRAILBLAZER_BONUS,
  applyAnswer,
  computeStreakMultiplier,
  shouldRefundLife,
} from '@/app/trivia/lib/infiniteScoring'

describe('computeStreakMultiplier', () => {
  it('returns 1 at streak 0', () => {
    expect(computeStreakMultiplier(0)).toBe(1)
  })

  it('returns 1 at streak 4 (below tier at 5)', () => {
    expect(computeStreakMultiplier(4)).toBe(1)
  })

  it('returns 1.5 at streak 5', () => {
    expect(computeStreakMultiplier(5)).toBe(1.5)
  })

  it('returns 1.5 at streak 9 (below tier at 10)', () => {
    expect(computeStreakMultiplier(9)).toBe(1.5)
  })

  it('returns 2 at streak 10', () => {
    expect(computeStreakMultiplier(10)).toBe(2)
  })

  it('returns 2 at streak 19 (below tier at 20)', () => {
    expect(computeStreakMultiplier(19)).toBe(2)
  })

  it('returns 3 at streak 20', () => {
    expect(computeStreakMultiplier(20)).toBe(3)
  })

  it('returns 3 at streak 50 (well above last tier)', () => {
    expect(computeStreakMultiplier(50)).toBe(3)
  })
})

describe('shouldRefundLife', () => {
  it('returns true at streak 10 when lives < LIVES_MAX', () => {
    expect(shouldRefundLife(10, 2)).toBe(true)
  })

  it('returns true at streak 20 when lives < LIVES_MAX', () => {
    expect(shouldRefundLife(20, 1)).toBe(true)
  })

  it('returns true at streak 30 when lives < LIVES_MAX', () => {
    expect(shouldRefundLife(30, 2)).toBe(true)
  })

  it('returns false at streak 10 when lives === LIVES_MAX', () => {
    expect(shouldRefundLife(10, LIVES_MAX)).toBe(false)
  })

  it('returns false at streak 5 (non-multiple of 10)', () => {
    expect(shouldRefundLife(5, 2)).toBe(false)
  })

  it('returns false at streak 0', () => {
    expect(shouldRefundLife(0, 2)).toBe(false)
  })

  it('returns false at streak 11 (non-multiple of 10)', () => {
    expect(shouldRefundLife(11, 1)).toBe(false)
  })
})

describe('applyAnswer', () => {
  const baseParams = {
    trailblazer: false,
    elapsedMs: 0,
    mode: 'scored' as const,
    prevLives: LIVES_START,
    prevStreak: 0,
    prevLongestStreak: 0,
    prevScore: 0,
  }

  it('increments streak and awards points on correct answer', () => {
    const result = applyAnswer({ ...baseParams, correct: true })
    expect(result.correct).toBe(true)
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(1)
    expect(result.points).toBeGreaterThan(0)
    expect(result.livesRemaining).toBe(LIVES_START)
    expect(result.runOver).toBe(false)
  })

  it('resets streak and decrements lives on wrong answer in scored mode', () => {
    const result = applyAnswer({ ...baseParams, correct: false, prevStreak: 3 })
    expect(result.correct).toBe(false)
    expect(result.currentStreak).toBe(0)
    expect(result.points).toBe(0)
    expect(result.livesRemaining).toBe(LIVES_START - 1)
    expect(result.runOver).toBe(false)
  })

  it('sets runOver when lives reach 0 in scored mode', () => {
    const result = applyAnswer({ ...baseParams, correct: false, prevLives: 1 })
    expect(result.livesRemaining).toBe(0)
    expect(result.runOver).toBe(true)
  })

  it('does NOT decrement lives on wrong answer in practice mode', () => {
    const result = applyAnswer({ ...baseParams, correct: false, mode: 'practice' })
    expect(result.livesRemaining).toBe(LIVES_START)
    expect(result.runOver).toBe(false)
  })

  it('applies streak multiplier after 5 correct answers', () => {
    // Build up to streak 4
    let state = { ...baseParams, prevScore: 0, prevStreak: 0, prevLongestStreak: 0, prevLives: LIVES_START }
    for (let i = 0; i < 4; i++) {
      const r = applyAnswer({ ...state, correct: true, elapsedMs: 0 })
      state = { ...state, prevStreak: r.currentStreak, prevLongestStreak: r.longestStreak, prevScore: r.score }
    }
    // 5th correct answer should trigger 1.5x multiplier
    const result = applyAnswer({ ...state, correct: true, elapsedMs: 0 })
    expect(result.currentStreak).toBe(5)
    // At streak 5: BASE_MAX_POINTS * 1.5 = 150
    expect(result.points).toBe(Math.round(BASE_MAX_POINTS * 1.5))
  })

  it('adds TRAILBLAZER_BONUS when trailblazer is true', () => {
    const regular = applyAnswer({ ...baseParams, correct: true, trailblazer: false, elapsedMs: 0 })
    const trailblazer = applyAnswer({ ...baseParams, correct: true, trailblazer: true, elapsedMs: 0 })
    expect(trailblazer.points - regular.points).toBe(TRAILBLAZER_BONUS)
    expect(trailblazer.trailblazer).toBe(true)
  })

  it('does not award trailblazer bonus on wrong answer', () => {
    const result = applyAnswer({ ...baseParams, correct: false, trailblazer: true, elapsedMs: 0 })
    expect(result.points).toBe(0)
  })

  it('refunds a life at streak 10 when lives are below max', () => {
    const result = applyAnswer({
      ...baseParams,
      correct: true,
      elapsedMs: 0,
      prevStreak: 9,
      prevLongestStreak: 9,
      prevLives: 2,
    })
    expect(result.currentStreak).toBe(10)
    expect(result.livesRemaining).toBe(3) // restored to LIVES_MAX
  })

  it('does not refund life at streak 10 when already at max lives', () => {
    const result = applyAnswer({
      ...baseParams,
      correct: true,
      elapsedMs: 0,
      prevStreak: 9,
      prevLongestStreak: 9,
      prevLives: LIVES_MAX,
    })
    expect(result.livesRemaining).toBe(LIVES_MAX)
  })

  it('accumulates score across answers', () => {
    const first = applyAnswer({ ...baseParams, correct: true, elapsedMs: 0, prevScore: 0 })
    const second = applyAnswer({ ...baseParams, correct: true, elapsedMs: 0, prevScore: first.score, prevStreak: 1, prevLongestStreak: 1 })
    expect(second.score).toBeGreaterThan(first.score)
  })

  it('scores the same regardless of elapsed time', () => {
    const fast = applyAnswer({ ...baseParams, correct: true, elapsedMs: 0 })
    const slow = applyAnswer({ ...baseParams, correct: true, elapsedMs: 25000 })
    expect(fast.points).toBe(slow.points)
    expect(fast.points).toBe(BASE_MAX_POINTS)
  })

  it('longestStreak does not decrease on wrong answer', () => {
    const result = applyAnswer({
      ...baseParams,
      correct: false,
      prevStreak: 5,
      prevLongestStreak: 5,
    })
    expect(result.longestStreak).toBe(5)
    expect(result.currentStreak).toBe(0)
  })
})
