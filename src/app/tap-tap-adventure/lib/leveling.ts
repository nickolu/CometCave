import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

const BASE_STEPS = 20
const STEPS_PER_LEVEL_INCREMENT = 5

/**
 * Steps required to reach a given level from level 1.
 * Formula: sum of (BASE_STEPS + level * STEPS_PER_LEVEL_INCREMENT) for each level.
 * Level 2 at 25 steps, Level 3 at 55, Level 4 at 90, etc.
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

const STAT_BONUS_PER_LEVEL = 1

/**
 * Apply level-derived stat bonuses to a character.
 * Returns a new character with updated level and stats.
 */
export function applyLevelFromDistance(character: FantasyCharacter): FantasyCharacter {
  const newLevel = calculateLevel(character.distance)
  if (newLevel === character.level) return character

  const levelsGained = newLevel - character.level
  if (levelsGained <= 0) return { ...character, level: newLevel }

  return {
    ...character,
    level: newLevel,
    strength: character.strength + levelsGained * STAT_BONUS_PER_LEVEL,
    intelligence: character.intelligence + levelsGained * STAT_BONUS_PER_LEVEL,
    luck: character.luck + levelsGained * STAT_BONUS_PER_LEVEL,
  }
}
