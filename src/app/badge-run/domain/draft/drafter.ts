import { makePRNG } from '../rng'
import type { CatalogUnit, Tier } from '../unit-catalog'
import type { PoolEntry } from './pool'

export type Board = CatalogUnit[]
export type ShopOffer = PoolEntry[]

export interface Drafter {
  /** Returns dexId to pick, or null to pass */
  pick(shop: ShopOffer, board: Board, seed: number): number | null
}

const TIER_VALUE: Record<Tier, number> = {
  T1: 1, T2: 2, T3: 3, T4: 4, T5: 5,
}

function synergyScore(unit: CatalogUnit, board: Board): number {
  // Count how many of the same kin exist on the board
  const kinCount = board.filter(b => b.kin === unit.kin).length
  // Count faction matches (if both are in a faction — use dexId sets)
  // Simplified: reward kin match strongly, faction needs dexId lookup so skip for now
  return kinCount * 2
}

function typeScore(unit: CatalogUnit, board: Board): number {
  // Reward new type coverage (types not already on the board)
  const existingTypes = new Set(board.flatMap(b => b.types))
  return unit.types.filter(t => !existingTypes.has(t)).length
}

/**
 * Scores a unit for the heuristic bot's pick decision.
 * Higher is better.
 */
function scoreUnit(unit: CatalogUnit, board: Board): number {
  return TIER_VALUE[unit.tier] * 10 + synergyScore(unit, board) + typeScore(unit, board)
}

/**
 * Heuristic bot: picks the highest-scoring available unit.
 * Breaks ties deterministically using the provided seed.
 */
export class HeuristicBot implements Drafter {
  pick(shop: ShopOffer, board: Board, seed: number): number | null {
    if (shop.length === 0) return null
    const rng = makePRNG(seed)
    // Score all offered units
    const scored = shop.map(entry => ({
      dexId: entry.unit.dexId,
      score: scoreUnit(entry.unit, board) + rng.next() * 0.001, // tiny RNG tiebreaker
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored[0].dexId
  }
}
