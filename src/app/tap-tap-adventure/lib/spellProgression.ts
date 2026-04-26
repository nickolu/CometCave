const XP_THRESHOLDS = [0, 3, 8, 15, 25] // Level 1-5

/**
 * Get the level for a given XP amount.
 */
export function getSpellLevel(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1
  }
  return 1
}

/**
 * Get the XP needed for the next level. Returns 0 if max level.
 */
export function getXpForNextLevel(level: number): number {
  if (level >= XP_THRESHOLDS.length) return 0
  return XP_THRESHOLDS[level]
}

/**
 * Get the damage/effect multiplier for a spell level.
 * Each level adds +10% (1.0, 1.1, 1.2, 1.3, 1.4).
 */
export function getSpellLevelMultiplier(level: number): number {
  return 1 + (Math.min(level, 5) - 1) * 0.1
}

/**
 * Max spell level.
 */
export const MAX_SPELL_LEVEL = 5
