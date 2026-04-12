import { describe, it, expect } from 'vitest'
import { getMetaBonuses } from '@/app/tap-tap-adventure/lib/metaProgressionBonuses'

describe('getMetaBonuses', () => {
  it('returns zero bonuses when no upgrades purchased', () => {
    const bonuses = getMetaBonuses({})
    expect(bonuses.bonusHp).toBe(0)
    expect(bonuses.bonusStrength).toBe(0)
    expect(bonuses.bonusIntelligence).toBe(0)
    expect(bonuses.bonusLuck).toBe(0)
    expect(bonuses.bonusGold).toBe(0)
    expect(bonuses.bonusMana).toBe(0)
    expect(bonuses.healRateMultiplier).toBe(1)
    expect(bonuses.xpMultiplier).toBe(1)
    expect(bonuses.shopDiscount).toBe(0)
    expect(bonuses.lootBonusChance).toBe(0)
  })

  it('calculates single upgrade at level 1', () => {
    const bonuses = getMetaBonuses({ resilience: 1 })
    expect(bonuses.bonusHp).toBe(5) // 5 per level
    expect(bonuses.bonusStrength).toBe(0)
  })

  it('calculates single upgrade at max level', () => {
    const bonuses = getMetaBonuses({ resilience: 5 })
    expect(bonuses.bonusHp).toBe(25) // 5 * 5
  })

  it('calculates fortune upgrade', () => {
    const bonuses = getMetaBonuses({ fortune: 3 })
    expect(bonuses.bonusGold).toBe(9) // 3 * 3
  })

  it('calculates stat upgrades stacking', () => {
    const bonuses = getMetaBonuses({
      warriors_blood: 2,
      scholars_mind: 3,
      lucky_star: 1,
    })
    expect(bonuses.bonusStrength).toBe(2)
    expect(bonuses.bonusIntelligence).toBe(3)
    expect(bonuses.bonusLuck).toBe(1)
  })

  it('calculates heal rate multiplier correctly', () => {
    // swift_recovery: 10% per level
    const bonuses = getMetaBonuses({ swift_recovery: 3 })
    expect(bonuses.healRateMultiplier).toBeCloseTo(1.3) // 1 + 3*10/100
  })

  it('calculates xp multiplier correctly', () => {
    // veterans_instinct: 5% per level
    const bonuses = getMetaBonuses({ veterans_instinct: 5 })
    expect(bonuses.xpMultiplier).toBeCloseTo(1.25) // 1 + 5*5/100
  })

  it('calculates shop discount', () => {
    const bonuses = getMetaBonuses({ merchant_favor: 4 })
    expect(bonuses.shopDiscount).toBe(20) // 5 * 4
  })

  it('calculates loot bonus', () => {
    const bonuses = getMetaBonuses({ treasure_hunter: 2 })
    expect(bonuses.lootBonusChance).toBe(10) // 5 * 2
  })

  it('handles multiple upgrades stacking', () => {
    const bonuses = getMetaBonuses({
      resilience: 3,
      fortune: 2,
      warriors_blood: 1,
      inner_focus: 4,
    })
    expect(bonuses.bonusHp).toBe(15) // 5 * 3
    expect(bonuses.bonusGold).toBe(6) // 3 * 2
    expect(bonuses.bonusStrength).toBe(1) // 1 * 1
    expect(bonuses.bonusMana).toBe(12) // 3 * 4
  })

  it('ignores unknown upgrade ids', () => {
    const bonuses = getMetaBonuses({ nonexistent_upgrade: 5 })
    expect(bonuses.bonusHp).toBe(0)
    expect(bonuses.bonusStrength).toBe(0)
  })
})
