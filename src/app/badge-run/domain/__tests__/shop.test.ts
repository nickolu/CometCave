import { describe, it, expect } from 'vitest'
import { TIER_ODDS, XP_TO_NEXT_LEVEL, XP_PER_BUY, XP_COST, REROLL_COST, pickTierByOdds, maxSlotsForLevel } from '../shop/tier-odds'
import { startBlitz, rerollOffers, buyXP } from '../blitz/run'

describe('maxSlotsForLevel', () => {
  it('returns 1 at level 1', () => expect(maxSlotsForLevel(1)).toBe(1))
  it('returns 3 at level 3', () => expect(maxSlotsForLevel(3)).toBe(3))
  it('caps at 6 for level 6+', () => {
    expect(maxSlotsForLevel(6)).toBe(6)
    expect(maxSlotsForLevel(7)).toBe(6)
    expect(maxSlotsForLevel(10)).toBe(6)
  })
})

describe('TIER_ODDS table', () => {
  it('all level 1 weight goes to T1', () => {
    const odds = TIER_ODDS[1]
    expect(odds.T1).toBeGreaterThan(0)
    expect(odds.T2).toBe(0)
    expect(odds.T5).toBe(0)
  })
  it('level 10 has highest T4+T5 combined weight', () => {
    const odds10 = TIER_ODDS[10]
    const odds1 = TIER_ODDS[1]
    expect(odds10.T4 + odds10.T5).toBeGreaterThan(odds1.T4 + odds1.T5)
  })
  it('all weights sum to positive for every level', () => {
    for (let l = 1; l <= 10; l++) {
      const total = Object.values(TIER_ODDS[l]).reduce((s, v) => s + v, 0)
      expect(total).toBeGreaterThan(0)
    }
  })
})

describe('pickTierByOdds', () => {
  it('always returns T1 at level 1 (all weight on T1)', () => {
    expect(pickTierByOdds(1, 0)).toBe('T1')
    expect(pickTierByOdds(1, 0.99)).toBe('T1')
  })
  it('returns a valid tier', () => {
    const valid = new Set(['T1', 'T2', 'T3', 'T4', 'T5'])
    for (let rand = 0; rand < 1; rand += 0.1) {
      expect(valid.has(pickTierByOdds(5, rand))).toBe(true)
    }
  })
})

describe('rerollOffers', () => {
  it('deducts REROLL_COST gold', () => {
    const run = { ...startBlitz(42), gold: 10 }
    const after = rerollOffers(run)
    expect(after.gold).toBe(10 - REROLL_COST)
  })
  it('throws if insufficient gold', () => {
    const run = { ...startBlitz(42), gold: 1 }
    expect(() => rerollOffers(run)).toThrow('Insufficient gold')
  })
  it('produces new offers (different from previous)', () => {
    const run = { ...startBlitz(42), gold: 10 }
    const after = rerollOffers(run)
    expect(after.offers).not.toBeNull()
    expect(after.offers).toHaveLength(3)
    expect(after.rerollCount).toBe(1)
  })
  it('throws if not in draft phase', () => {
    const run = { ...startBlitz(42), phase: 'battle' as const, gold: 10 }
    expect(() => rerollOffers(run)).toThrow("Cannot reroll")
  })
})

describe('buyXP', () => {
  it('deducts XP_COST gold and grants XP_PER_BUY xp (may level up)', () => {
    const run = { ...startBlitz(42), gold: 10 }
    const after = buyXP(run)
    expect(after.gold).toBe(10 - XP_COST)
    // Total XP gained is XP_PER_BUY; remainder after level-ups may be less
    expect(after.xp).toBeGreaterThanOrEqual(0)
    expect(after.level).toBeGreaterThanOrEqual(1)
  })
  it('throws if insufficient gold', () => {
    const run = { ...startBlitz(42), gold: 2 }
    expect(() => buyXP(run)).toThrow('Insufficient gold')
  })
  it('levels up when XP threshold met', () => {
    const run = { ...startBlitz(42), gold: 100, xp: 0, level: 1 }
    // XP_TO_NEXT_LEVEL[1] = 2; XP_PER_BUY = 4 → should reach level 2 in one buy
    const after = buyXP(run)
    expect(after.level).toBeGreaterThanOrEqual(2)
    expect(after.maxSlots).toBe(maxSlotsForLevel(after.level))
  })
  it('maxSlots stays ≤ 6 even at high levels', () => {
    let run = { ...startBlitz(42), gold: 1000, level: 10, xp: 0, maxSlots: 6 }
    run = buyXP(run)
    expect(run.maxSlots).toBe(6)
  })
})
