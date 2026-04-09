import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'

const XP_PER_DECISION = 25
const XP_BONUS_SUCCESS = 15

export function calculateXpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

export function getXpForDecision(outcome: 'success' | 'failure'): number {
  return XP_PER_DECISION + (outcome === 'success' ? XP_BONUS_SUCCESS : 0)
}

export interface LevelUpResult {
  character: FantasyCharacter
  leveledUp: boolean
  levelsGained: number
  xpGained: number
}

export function applyXpGain(character: FantasyCharacter, xpGained: number): LevelUpResult {
  let xp = (character.xp ?? 0) + xpGained
  let level = character.level
  let xpToNextLevel = character.xpToNextLevel ?? calculateXpToNextLevel(level)
  let levelsGained = 0

  while (xp >= xpToNextLevel) {
    xp -= xpToNextLevel
    level += 1
    levelsGained += 1
    xpToNextLevel = calculateXpToNextLevel(level)
  }

  const statBoost = levelsGained
  const updatedCharacter: FantasyCharacter = {
    ...character,
    level,
    xp,
    xpToNextLevel,
    strength: character.strength + statBoost,
    intelligence: character.intelligence + statBoost,
    luck: character.luck + statBoost,
  }

  return {
    character: updatedCharacter,
    leveledUp: levelsGained > 0,
    levelsGained,
    xpGained,
  }
}
