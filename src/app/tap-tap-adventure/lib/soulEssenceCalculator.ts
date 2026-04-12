import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

/**
 * Calculate Soul Essence earned from a completed run (death or retirement).
 */
export function calculateSoulEssence(character: FantasyCharacter): number {
  let essence = 0

  // Base: 1 essence per 10 distance
  essence += Math.floor(character.distance / 10)

  // Level bonus: 5 per level
  essence += character.level * 5

  // Death count penalty: -10% per death (non-permadeath), minimum 50% retained
  const deathPenalty = Math.max(0.5, 1 - character.deathCount * 0.1)
  essence = Math.floor(essence * deathPenalty)

  // Difficulty multiplier
  const diffMultipliers: Record<string, number> = {
    casual: 0.5,
    normal: 1,
    hard: 1.5,
    ironman: 2.5,
  }
  essence = Math.floor(essence * (diffMultipliers[character.difficultyMode ?? 'normal'] ?? 1))

  // Minimum 1 essence per run
  return Math.max(1, essence)
}
