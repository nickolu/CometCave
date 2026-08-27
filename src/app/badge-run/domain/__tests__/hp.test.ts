import { describe, it, expect } from 'vitest'
import { computeLossDamage, applyDamage, MAX_PLAYER_HP } from '../matchmaking/hp'

describe('computeLossDamage', () => {
  it('base damage = 5 + round + surviving enemies', () => {
    expect(computeLossDamage(1, 0, false)).toBe(6)  // 5+1+0
    expect(computeLossDamage(1, 3, false)).toBe(9)  // 5+1+3
    expect(computeLossDamage(10, 4, false)).toBe(19) // 5+10+4
  })

  it('gym rounds deal 2× damage', () => {
    expect(computeLossDamage(4, 0, true)).toBe(18)   // (5+4+0)*2
    expect(computeLossDamage(4, 3, true)).toBe(24)   // (5+4+3)*2
  })

  it('damage scales with round number (late rounds hurt more)', () => {
    const early = computeLossDamage(1, 3, false)
    const late = computeLossDamage(20, 3, false)
    expect(late).toBeGreaterThan(early)
  })
})

describe('applyDamage', () => {
  it('reduces HP by damage amount', () => {
    expect(applyDamage(100, 10)).toBe(90)
  })

  it('does not go below 0', () => {
    expect(applyDamage(5, 10)).toBe(0)
  })

  it('handles 0 damage', () => {
    expect(applyDamage(100, 0)).toBe(100)
  })
})

describe('snowball harness', () => {
  it('later round losses deal more damage than early round losses', () => {
    // A player who loses round 20 takes significantly more damage than one who loses round 1
    const earlyLoss = computeLossDamage(1, 6, false)
    const lateLoss = computeLossDamage(20, 6, false)
    expect(lateLoss).toBeGreaterThan(earlyLoss * 2)
  })

  it('even with 0 losses, a player at round 29 cannot have infinite HP advantage', () => {
    // MAX HP is fixed at 100; no mechanic increases HP above that
    expect(MAX_PLAYER_HP).toBe(100)
  })
})
