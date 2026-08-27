/** Maximum survival level a unit can accumulate. */
export const MAX_SURVIVAL_LEVEL = 25

/** Stat multiplier bonus per survival level (4%). */
export const STAT_BONUS_PER_LEVEL = 0.04

/**
 * Apply survival level stat bonus to raw stats.
 * All stats scale linearly: stat * (1 + level * STAT_BONUS_PER_LEVEL).
 * Uses Math.round to avoid floating point artifacts.
 */
export function applyLevelBonus(rawStats: {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}, level: number): {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
} {
  if (level <= 0) return rawStats
  const mult = 1 + Math.min(MAX_SURVIVAL_LEVEL, level) * STAT_BONUS_PER_LEVEL
  return {
    hp: Math.round(rawStats.hp * mult),
    attack: Math.round(rawStats.attack * mult),
    defense: Math.round(rawStats.defense * mult),
    specialAttack: Math.round(rawStats.specialAttack * mult),
    specialDefense: Math.round(rawStats.specialDefense * mult),
    speed: Math.round(rawStats.speed * mult),
  }
}

/**
 * Increment survival levels for units that participated in a won round.
 * Returns updated levels map (Record<dexId, level>).
 * Units not present in the map start at 0.
 */
export function survivedRound(
  boardLevels: Record<number, number>,
  survivingDexIds: number[],
): Record<number, number> {
  const updated = { ...boardLevels }
  for (const dexId of survivingDexIds) {
    updated[dexId] = Math.min(MAX_SURVIVAL_LEVEL, (updated[dexId] ?? 0) + 1)
  }
  return updated
}
