import { describe, it, expect } from 'vitest'
import { applyLevelBonus, survivedRound, MAX_SURVIVAL_LEVEL, STAT_BONUS_PER_LEVEL } from '../levels/survival'
import { UNIT_CATALOG } from '../unit-catalog'

const BASE_STATS = { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 }

describe('applyLevelBonus', () => {
  it('returns unchanged stats at level 0', () => {
    expect(applyLevelBonus(BASE_STATS, 0)).toEqual(BASE_STATS)
  })

  it('adds STAT_BONUS_PER_LEVEL per level', () => {
    const result = applyLevelBonus(BASE_STATS, 1)
    expect(result.hp).toBe(Math.round(100 * (1 + STAT_BONUS_PER_LEVEL)))
    expect(result.attack).toBe(Math.round(100 * (1 + STAT_BONUS_PER_LEVEL)))
  })

  it('applies correct bonus at level 25 (max)', () => {
    const result = applyLevelBonus(BASE_STATS, 25)
    expect(result.hp).toBe(Math.round(100 * (1 + 25 * STAT_BONUS_PER_LEVEL)))
  })

  it('caps at level 25 — level 30 gives same result as level 25', () => {
    const at25 = applyLevelBonus(BASE_STATS, 25)
    const at30 = applyLevelBonus(BASE_STATS, 30)
    expect(at30).toEqual(at25)
  })

  it('balance: maxed T1 loses to fresh T3 (sell decisions are correct)', () => {
    // B-8.4 balance pass: STAT_BONUS_PER_LEVEL reduced from 4% to 2.5%.
    // At 2.5%, maxed T1 (BST × 1.625) should lose to fresh T3 (BST ≈ 525+).
    // This makes selling for T3+ always the correct decision.
    const bulbasaur = UNIT_CATALOG.find(u => u.dexId === 1)!  // T1, BST 318
    const venusaur = UNIT_CATALOG.find(u => u.dexId === 3)!   // T3, BST 525

    const bulbasaurMaxed = applyLevelBonus(bulbasaur.baseStats, 25)
    const venusaurFresh = venusaur.baseStats

    const maxedT1BST = Object.values(bulbasaurMaxed).reduce((s, v) => s + v, 0)
    const freshT3BST = Object.values(venusaurFresh).reduce((s, v) => s + v, 0)

    // Selling T1 for T3 should be correct: maxed T1 must lose to fresh T3.
    expect(maxedT1BST).toBeLessThan(freshT3BST)
  })
})

describe('survivedRound', () => {
  it('increments level for each surviving dexId', () => {
    const levels = survivedRound({}, [1, 2, 3])
    expect(levels[1]).toBe(1)
    expect(levels[2]).toBe(1)
    expect(levels[3]).toBe(1)
  })

  it('accumulates across rounds', () => {
    let levels = survivedRound({}, [1])
    levels = survivedRound(levels, [1])
    levels = survivedRound(levels, [1])
    expect(levels[1]).toBe(3)
  })

  it('caps at MAX_SURVIVAL_LEVEL', () => {
    let levels: Record<number, number> = { 1: MAX_SURVIVAL_LEVEL }
    levels = survivedRound(levels, [1])
    expect(levels[1]).toBe(MAX_SURVIVAL_LEVEL)
  })

  it('does not affect units not in the surviving list', () => {
    const levels = survivedRound({ 1: 5 }, [2])
    expect(levels[1]).toBe(5)
    expect(levels[2]).toBe(1)
  })
})
