import { describe, expect, it } from 'vitest'

import { getAccuracyBadge } from '@/app/trivia/lib/accuracyBadge'

describe('getAccuracyBadge', () => {
  it('returns null with no prior plays (trailblazer covers it)', () => {
    expect(getAccuracyBadge(0, 0)).toBeNull()
  })

  it('returns null when priorTimesShown is negative (defensive)', () => {
    expect(getAccuracyBadge(-1, 0)).toBeNull()
  })

  it('shows count-only for 1 prior play', () => {
    expect(getAccuracyBadge(1, 1)).toBe('1 of 1 got this right')
    expect(getAccuracyBadge(1, 0)).toBe('0 of 1 got this right')
  })

  it('shows count-only for 4 prior plays (just under threshold)', () => {
    expect(getAccuracyBadge(4, 3)).toBe('3 of 4 got this right')
  })

  it('switches to percentage at exactly 5 prior plays', () => {
    expect(getAccuracyBadge(5, 3)).toBe('60% got this right · 5 plays')
  })

  it('rounds the percentage to the nearest integer', () => {
    // 12 / 18 = 66.66...% → 67
    expect(getAccuracyBadge(18, 12)).toBe('67% got this right · 18 plays')
    // 1 / 3 wouldn't apply here (under threshold), but 33 / 100 = 33%
    expect(getAccuracyBadge(100, 33)).toBe('33% got this right · 100 plays')
  })

  it('handles 0% and 100% extremes for large samples', () => {
    expect(getAccuracyBadge(20, 0)).toBe('0% got this right · 20 plays')
    expect(getAccuracyBadge(20, 20)).toBe('100% got this right · 20 plays')
  })
})
