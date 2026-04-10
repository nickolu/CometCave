import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

const BASE_STEPS = 200
const STEPS_PER_LEVEL_INCREMENT = 50

// Milestone constants
export const STEPS_PER_DAY = 50
export const SHOP_MILESTONE_INTERVAL = 100
export const BOSS_MILESTONE_INTERVAL = 500

/**
 * Steps required to reach a given level from level 1.
 * Level 2 at 250 steps, Level 3 at 550, Level 4 at 900, etc.
 */
export function stepsRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  let total = 0
  for (let l = 1; l < level; l++) {
    total += BASE_STEPS + l * STEPS_PER_LEVEL_INCREMENT
  }
  return total
}

/**
 * Steps needed to go from current level to next level.
 */
export function stepsToNextLevel(level: number): number {
  return BASE_STEPS + level * STEPS_PER_LEVEL_INCREMENT
}

/**
 * Derive level from total distance traveled.
 */
export function calculateLevel(distance: number): number {
  let level = 1
  let stepsUsed = 0
  while (true) {
    const needed = stepsToNextLevel(level)
    if (stepsUsed + needed > distance) break
    stepsUsed += needed
    level++
  }
  return level
}

/**
 * Progress toward next level as a fraction (0 to 1).
 */
export function levelProgress(distance: number): number {
  const level = calculateLevel(distance)
  const currentLevelStart = stepsRequiredForLevel(level)
  const needed = stepsToNextLevel(level)
  const progress = distance - currentLevelStart
  return Math.min(1, Math.max(0, progress / needed))
}

/**
 * Calculate current day from distance.
 */
export function calculateDay(distance: number): number {
  return Math.floor(distance / STEPS_PER_DAY) + 1
}

/**
 * Calculate max HP for a character based on stats.
 */
export function calculateMaxHp(character: FantasyCharacter): number {
  return 30 + character.strength * 3 + character.level * 8
}

const HEAL_RATE = 3 // heal 1 HP every N steps

/**
 * Check if a step milestone was just crossed.
 */
export function crossedMilestone(oldDistance: number, newDistance: number, interval: number): boolean {
  return Math.floor(newDistance / interval) > Math.floor(oldDistance / interval)
}

export const STAT_POINTS_PER_LEVEL = 3

/**
 * Apply level-derived stat bonuses and update maxHp.
 * Instead of auto-applying stat increases, accumulates pending stat points.
 * Also heals 1 HP per step (called on distance change).
 */
export function applyLevelFromDistance(
  character: FantasyCharacter,
  stepsGained: number = 1
): FantasyCharacter {
  const newLevel = calculateLevel(character.distance)
  let updated = { ...character }

  if (newLevel > character.level) {
    const levelsGained = newLevel - character.level
    updated = {
      ...updated,
      level: newLevel,
      pendingStatPoints: (character.pendingStatPoints ?? 0) + levelsGained * STAT_POINTS_PER_LEVEL,
    }
  } else if (newLevel < character.level) {
    updated.level = newLevel
  }

  // Update maxHp and heal (1 HP every HEAL_RATE steps)
  const maxHp = calculateMaxHp(updated)
  const currentHp = updated.hp ?? maxHp
  const healAmount = Math.floor(stepsGained / HEAL_RATE)
  const healed = Math.min(maxHp, currentHp + healAmount)

  return {
    ...updated,
    hp: healed,
    maxHp,
  }
}
