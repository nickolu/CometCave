import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

export interface DeathPenalty {
  goldLost: number
  itemsLost: number
  reputationLost: number
  newDeathCount: number
}

/**
 * Calculate and apply death penalties when a character is defeated in combat.
 * - 25% gold loss
 * - All non-equipped inventory items cleared
 * - 5 reputation lost
 * - Death count incremented
 */
export function applyDeathPenalty(character: FantasyCharacter): {
  updatedCharacter: FantasyCharacter
  penalty: DeathPenalty
} {
  const goldLost = Math.floor(character.gold * 0.25)
  const itemsLost = character.inventory.filter(i => i.status !== 'deleted').length
  const newDeathCount = (character.deathCount ?? 0) + 1

  const updatedCharacter: FantasyCharacter = {
    ...character,
    gold: Math.max(0, character.gold - goldLost),
    inventory: [], // Clear all inventory (equipped items would be in equipment slots if that system exists)
    reputation: character.reputation - 5,
    deathCount: newDeathCount,
  }

  return {
    updatedCharacter,
    penalty: {
      goldLost,
      itemsLost,
      reputationLost: 5,
      newDeathCount,
    },
  }
}
