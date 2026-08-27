import { makePRNG } from '../rng'
import { UNIT_CATALOG, type CatalogUnit } from '../unit-catalog'
import type { Tier } from '../unit-catalog'

/**
 * Tier weights for rival team generation based on round number.
 * Early rounds: mostly T1-T2. Later rounds: more T3-T5.
 */
const RIVAL_TIER_WEIGHTS_BY_ROUND: Array<Record<Tier, number>> = [
  // Rounds 1-5: early game
  { T1: 60, T2: 35, T3: 5, T4: 0, T5: 0 },
  // Rounds 6-10: mid game
  { T1: 40, T2: 35, T3: 20, T4: 5, T5: 0 },
  // Rounds 11-15: late mid
  { T1: 20, T2: 30, T3: 35, T4: 14, T5: 1 },
  // Rounds 16-20: late game
  { T1: 10, T2: 20, T3: 35, T4: 30, T5: 5 },
  // Rounds 21-25: end game
  { T1: 5, T2: 10, T3: 30, T4: 40, T5: 15 },
  // Rounds 26-29: Elite Four (hardest)
  { T1: 0, T2: 5, T3: 20, T4: 45, T5: 30 },
]

function weightsForRound(round: number): Record<Tier, number> {
  if (round <= 5)  return RIVAL_TIER_WEIGHTS_BY_ROUND[0]
  if (round <= 10) return RIVAL_TIER_WEIGHTS_BY_ROUND[1]
  if (round <= 15) return RIVAL_TIER_WEIGHTS_BY_ROUND[2]
  if (round <= 20) return RIVAL_TIER_WEIGHTS_BY_ROUND[3]
  if (round <= 25) return RIVAL_TIER_WEIGHTS_BY_ROUND[4]
  return RIVAL_TIER_WEIGHTS_BY_ROUND[5]
}

function pickTierByWeights(weights: Record<Tier, number>, rand: number): Tier {
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5']
  const total = tiers.reduce((sum, t) => sum + weights[t], 0)
  let accumulated = 0
  for (const tier of tiers) {
    accumulated += weights[tier]
    if (rand * total < accumulated) return tier
  }
  return 'T1'
}

/**
 * Generate a rival team for a given round using tier-weighted selection.
 * Teams become progressively harder as rounds increase.
 */
export function generateRivalTeam(seed: number, round: number): CatalogUnit[] {
  const rng = makePRNG(seed ^ (round * 0x9e3779b9))
  const weights = weightsForRound(round)
  const picks: CatalogUnit[] = []
  const usedDexIds = new Set<number>()

  while (picks.length < 6) {
    const tierRand = rng.nextInt(1000000) / 1000000
    const tier = pickTierByWeights(weights, tierRand)
    const tierUnits = UNIT_CATALOG.filter(u => u.tier === tier && !usedDexIds.has(u.dexId))

    if (tierUnits.length === 0) {
      // Fall back to any unused unit
      const any = UNIT_CATALOG.filter(u => !usedDexIds.has(u.dexId))
      if (any.length === 0) break
      const unit = any[rng.nextInt(any.length)]
      usedDexIds.add(unit.dexId)
      picks.push(unit)
    } else {
      const unit = tierUnits[rng.nextInt(tierUnits.length)]
      usedDexIds.add(unit.dexId)
      picks.push(unit)
    }
  }

  return picks
}
