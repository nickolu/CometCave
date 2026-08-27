import { describe, it, expect } from 'vitest'
import { applyLevelBonus, survivedRound, MAX_SURVIVAL_LEVEL, STAT_BONUS_PER_LEVEL } from '../levels/survival'
import { UNIT_CATALOG } from '../unit-catalog'

const BASE_STATS = { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 }

describe('applyLevelBonus', () => {
  it('returns unchanged stats at level 0', () => {
    expect(applyLevelBonus(BASE_STATS, 0)).toEqual(BASE_STATS)
  })

  it('adds 4% per level', () => {
    const result = applyLevelBonus(BASE_STATS, 1)
    expect(result.hp).toBe(Math.round(100 * 1.04))
    expect(result.attack).toBe(Math.round(100 * 1.04))
  })

  it('applies correct bonus at level 25 (max)', () => {
    const result = applyLevelBonus(BASE_STATS, 25)
    expect(result.hp).toBe(Math.round(100 * (1 + 25 * 0.04)))
  })

  it('caps at level 25 — level 30 gives same result as level 25', () => {
    const at25 = applyLevelBonus(BASE_STATS, 25)
    const at30 = applyLevelBonus(BASE_STATS, 30)
    expect(at30).toEqual(at25)
  })

  it('reports never-sell flag: maxed T1 vs fresh T2 BST comparison', () => {
    // B-5.4 spec: "If never selling is always correct, flag it."
    // Bulbasaur (T1) at level 25 vs Ivysaur (T2) at level 0
    const bulbasaur = UNIT_CATALOG.find(u => u.dexId === 1)!
    const ivysaur = UNIT_CATALOG.find(u => u.dexId === 2)!

    const bulbasaurMaxed = applyLevelBonus(bulbasaur.baseStats, 25)
    const ivysaurFresh = ivysaur.baseStats

    const maxedBST = Object.values(bulbasaurMaxed).reduce((s, v) => s + v, 0)
    const freshT2BST = Object.values(ivysaurFresh).reduce((s, v) => s + v, 0)

    // FLAG: At +4%/level × 25, maxed T1 (636) >> fresh T2 (405).
    // "Never selling" dominates at current values — future balance pass needed.
    if (maxedBST >= freshT2BST) {
      console.warn(
        `[B-5.4 FLAG] Never-sell may dominate: maxed T1 BST ${maxedBST} >= fresh T2 BST ${freshT2BST}. ` +
        `Consider reducing STAT_BONUS_PER_LEVEL (currently ${STAT_BONUS_PER_LEVEL}) or lowering MAX_SURVIVAL_LEVEL.`
      )
    }

    // Test always passes — this is a diagnostic report, not a blocking assertion.
    // The flag is surfaced via console.warn for future balance tuning.
    expect(maxedBST).toBeGreaterThan(0)
    expect(freshT2BST).toBeGreaterThan(0)
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
