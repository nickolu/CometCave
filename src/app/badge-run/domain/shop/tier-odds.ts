import type { Tier } from '../unit-catalog'

/**
 * Tier odds table by player level (1-10).
 * Levels 1-6 unlock team slots; levels 7-10 raise higher-tier odds.
 * Values are weights (will be normalized), not percentages.
 */
export const TIER_ODDS: Record<number, Record<Tier, number>> = {
  1:  { T1: 100, T2:   0, T3:  0, T4:  0, T5:  0 },
  2:  { T1:  70, T2:  30, T3:  0, T4:  0, T5:  0 },
  3:  { T1:  60, T2:  35, T3:  5, T4:  0, T5:  0 },
  4:  { T1:  50, T2:  35, T3: 15, T4:  0, T5:  0 },
  5:  { T1:  45, T2:  33, T3: 20, T4:  2, T5:  0 },
  6:  { T1:  35, T2:  30, T3: 25, T4: 10, T5:  0 },
  7:  { T1:  19, T2:  30, T3: 35, T4: 15, T5:  1 },
  8:  { T1:  14, T2:  20, T3: 35, T4: 25, T5:  6 },
  9:  { T1:  10, T2:  15, T3: 30, T4: 30, T5: 15 },
  10: { T1:   5, T2:  10, T3: 20, T4: 40, T5: 25 },
}

/**
 * XP required to reach the next level (keyed by current level).
 * Reaching level 10 requires 50 additional XP at level 9.
 */
export const XP_TO_NEXT_LEVEL: Record<number, number> = {
  1:  2,
  2:  6,
  3: 10,
  4: 14,
  5: 20,
  6: 26,
  7: 32,
  8: 40,
  9: 50,
  // Level 10 is the cap; no next level
}

/** XP gained per buy action. */
export const XP_PER_BUY = 4
/** Gold cost to buy XP. */
export const XP_COST = 4
/** Gold cost to reroll shop offers. */
export const REROLL_COST = 2

/** Maximum team slots by level (capped at 6). */
export function maxSlotsForLevel(level: number): number {
  return Math.min(6, level)
}

/**
 * Pick a random tier based on the level's odds using the given random value [0,1).
 */
export function pickTierByOdds(level: number, rand: number): Tier {
  const odds = TIER_ODDS[Math.max(1, Math.min(10, level))]
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5']
  const total = tiers.reduce((sum, t) => sum + odds[t], 0)

  let accumulated = 0
  for (const tier of tiers) {
    accumulated += odds[tier]
    if (rand * total < accumulated) return tier
  }
  return 'T1'
}
