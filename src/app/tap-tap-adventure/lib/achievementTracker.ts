import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'
import { PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { GameState } from '@/app/tap-tap-adventure/models/types'

export type AchievementEvent =
  | { type: 'combat_win'; hpAfterCombat: number; maxHp: number; isBoss: boolean }
  | { type: 'shop_purchase' }
  | { type: 'death' }

/**
 * Checks all achievements against the current character and game state.
 * Returns an updated array of PlayerAchievements and a list of newly completed achievement IDs.
 */
export function checkAchievements(
  character: FantasyCharacter,
  gameState: GameState,
  currentAchievements: PlayerAchievement[],
  event?: AchievementEvent
): { achievements: PlayerAchievement[]; newlyCompleted: string[] } {
  const achievementMap = new Map<string, PlayerAchievement>()
  for (const pa of currentAchievements) {
    achievementMap.set(pa.achievementId, { ...pa })
  }

  const newlyCompleted: string[] = []

  for (const achievement of ACHIEVEMENTS) {
    const existing = achievementMap.get(achievement.id)
    if (existing?.completed) continue

    const progress = getProgress(achievement.id, character, gameState, currentAchievements, event)
    const completed = progress >= achievement.requirement

    const playerAchievement: PlayerAchievement = {
      achievementId: achievement.id,
      progress,
      completed,
      completedAt: completed ? (existing?.completedAt ?? new Date().toISOString()) : undefined,
    }

    if (completed && !existing?.completed) {
      newlyCompleted.push(achievement.id)
    }

    achievementMap.set(achievement.id, playerAchievement)
  }

  return {
    achievements: Array.from(achievementMap.values()),
    newlyCompleted,
  }
}

function getProgress(
  achievementId: string,
  character: FantasyCharacter,
  _gameState: GameState,
  currentAchievements: PlayerAchievement[],
  event?: AchievementEvent
): number {
  // Travel achievements — snapshot of distance
  if (achievementId.startsWith('travel_')) {
    return character.distance ?? 0
  }

  // Combat cumulative achievements — increment on combat_win event
  if (achievementId === 'combat_first_blood' || achievementId === 'combat_warriors_path' || achievementId === 'combat_slayer') {
    const existing = currentAchievements.find(a => a.achievementId === achievementId)
    const current = existing?.progress ?? 0
    if (event?.type === 'combat_win') {
      return current + 1
    }
    return current
  }

  // Boss killer — event-based
  if (achievementId === 'combat_boss_killer') {
    const existing = currentAchievements.find(a => a.achievementId === achievementId)
    const current = existing?.progress ?? 0
    if (event?.type === 'combat_win' && event.isBoss) {
      return current + 1
    }
    return current
  }

  // Untouchable — event-based (win at full HP)
  if (achievementId === 'combat_untouchable') {
    const existing = currentAchievements.find(a => a.achievementId === achievementId)
    if (existing?.completed) return existing.progress
    if (event?.type === 'combat_win' && event.hpAfterCombat >= event.maxHp) {
      return 1
    }
    return existing?.progress ?? 0
  }

  // Collection — snapshot of inventory
  if (achievementId === 'collection_collector' || achievementId === 'collection_hoarder') {
    const activeItems = character.inventory?.filter(i => i.status !== 'deleted') ?? []
    return activeItems.length
  }

  // Spell scholar — snapshot of spellbook
  if (achievementId === 'collection_spell_scholar') {
    return character.spellbook?.length ?? 0
  }

  // Well equipped — snapshot of equipment slots filled
  if (achievementId === 'collection_well_equipped') {
    const eq = character.equipment ?? { weapon: null, armor: null, accessory: null }
    let filled = 0
    if (eq.weapon) filled++
    if (eq.armor) filled++
    if (eq.accessory) filled++
    return filled
  }

  // Level achievements — snapshot
  if (achievementId.startsWith('progression_level_')) {
    return character.level ?? 1
  }

  // Rich — snapshot of gold
  if (achievementId === 'progression_rich') {
    return character.gold ?? 0
  }

  // Famous — snapshot of reputation
  if (achievementId === 'progression_famous') {
    return character.reputation ?? 0
  }

  // Survivor — event-based (survive with < 5 HP)
  if (achievementId === 'special_survivor') {
    const existing = currentAchievements.find(a => a.achievementId === achievementId)
    if (existing?.completed) return existing.progress
    if (event?.type === 'combat_win' && event.hpAfterCombat < 5 && event.hpAfterCombat > 0) {
      return 1
    }
    return existing?.progress ?? 0
  }

  // Shopkeeper's friend — cumulative
  if (achievementId === 'special_shopkeeper_friend') {
    const existing = currentAchievements.find(a => a.achievementId === achievementId)
    const current = existing?.progress ?? 0
    if (event?.type === 'shop_purchase') {
      return current + 1
    }
    return current
  }

  // Death defier — event-based
  if (achievementId === 'special_death_defier') {
    const existing = currentAchievements.find(a => a.achievementId === achievementId)
    if (existing?.completed) return existing.progress
    if (event?.type === 'death') {
      return 1
    }
    return existing?.progress ?? 0
  }

  return 0
}
