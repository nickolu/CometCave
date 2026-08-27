import { describe, it, expect } from 'vitest'
import { computeInterest, computeStreakBonus, computeRoundIncome, BASE_INCOME } from '../economy/gold'

describe('computeInterest', () => {
  it('returns 0 for 0 gold saved', () => {
    expect(computeInterest(0)).toBe(0)
  })
  it('returns 0 for 9 gold saved', () => {
    expect(computeInterest(9)).toBe(0)
  })
  it('returns 1 for 10 gold saved', () => {
    expect(computeInterest(10)).toBe(1)
  })
  it('returns 1 for 19 gold saved', () => {
    expect(computeInterest(19)).toBe(1)
  })
  it('returns 3 for 30 gold saved', () => {
    expect(computeInterest(30)).toBe(3)
  })
  it('caps at 5 for 50 gold saved', () => {
    expect(computeInterest(50)).toBe(5)
  })
  it('caps at 5 for 100 gold saved', () => {
    expect(computeInterest(100)).toBe(5)
  })
})

describe('computeStreakBonus', () => {
  it('returns 0 for streak 0', () => {
    expect(computeStreakBonus(0)).toBe(0)
  })
  it('returns 1 for streak 1', () => {
    expect(computeStreakBonus(1)).toBe(1)
  })
  it('returns 2 for streak 2', () => {
    expect(computeStreakBonus(2)).toBe(2)
  })
  it('returns 3 for streak 3', () => {
    expect(computeStreakBonus(3)).toBe(3)
  })
  it('caps at 3 for streak 5', () => {
    expect(computeStreakBonus(5)).toBe(3)
  })
})

describe('computeRoundIncome', () => {
  it('returns base income with no savings and no streak', () => {
    expect(computeRoundIncome(0, 0)).toBe(BASE_INCOME)
  })
  it('adds interest for 10 gold saved', () => {
    expect(computeRoundIncome(10, 0)).toBe(BASE_INCOME + 1)
  })
  it('adds streak bonus', () => {
    expect(computeRoundIncome(0, 2)).toBe(BASE_INCOME + 2)
  })
  it('combines interest and streak', () => {
    expect(computeRoundIncome(20, 3)).toBe(BASE_INCOME + 2 + 3)
  })
  it('caps total bonus correctly at max values', () => {
    expect(computeRoundIncome(50, 10)).toBe(BASE_INCOME + 5 + 3)
  })
})
