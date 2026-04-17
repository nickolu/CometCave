import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'
import { Skill } from '@/app/tap-tap-adventure/models/skill'

/**
 * Returns the list of skills the player qualifies for based on their
 * character state and achievement progress.
 */
export function getUnlockedSkills(
  character: FantasyCharacter,
  achievements: PlayerAchievement[]
): Skill[] {
  const completedAchievements = new Set(
    achievements.filter(a => a.completed).map(a => a.achievementId)
  )

  // Count combat wins from the cumulative achievement trackers
  const combatsWonAchievement = achievements.find(
    a => a.achievementId === 'combat_slayer'
  )
  const combatsWonFromWarriors = achievements.find(
    a => a.achievementId === 'combat_warriors_path'
  )
  // Use whichever tracker has the highest progress as the best estimate
  const combatsWon = Math.max(
    combatsWonAchievement?.progress ?? 0,
    combatsWonFromWarriors?.progress ?? 0
  )

  return SKILLS.filter(skill => {
    const req = skill.requirement
    switch (req.type) {
      case 'achievement':
        return completedAchievements.has(req.value as string)
      case 'level':
        return character.level >= (req.value as number)
      case 'distance':
        return (character.distance ?? 0) >= (req.value as number)
      case 'combats_won':
        return combatsWon >= (req.value as number)
      default:
        return false
    }
  })
}

/**
 * Calculates the total bonus for a given target from all unlocked skills.
 * For percentage bonuses, these are additive (e.g., two +10% bonuses = +20%).
 */
export function getSkillBonus(
  unlockedSkills: Skill[],
  target: string
): { flat: number; percentage: number } {
  let flat = 0
  let percentage = 0

  for (const skill of unlockedSkills) {
    if (skill.effect.target !== target) continue
    switch (skill.effect.type) {
      case 'flat_bonus':
      case 'stat_bonus':
        flat += skill.effect.value
        break
      case 'percentage_bonus':
        percentage += skill.effect.value
        break
      case 'special':
        // Special effects are handled individually by the consuming code
        flat += skill.effect.value
        break
    }
  }

  return { flat, percentage }
}

/**
 * Check if the player has unlocked a specific skill by ID.
 */
export function hasSkill(unlockedSkills: Skill[], skillId: string): boolean {
  return unlockedSkills.some(s => s.id === skillId)
}

/**
 * Given a character and achievements, compute the skill IDs that should be unlocked.
 * Returns the array of skill IDs.
 */
export function computeUnlockedSkillIds(
  character: FantasyCharacter,
  achievements: PlayerAchievement[]
): string[] {
  return getUnlockedSkills(character, achievements).map(s => s.id)
}

/**
 * Compute which class skill tree node IDs should be unlocked based on the
 * character's level and prerequisite chain.
 *
 * Prerequisites must always reference lower-tier nodes (enforced during tree
 * generation), so iterating tier-ascending prevents cycles without a full
 * graph check.
 */
export function computeUnlockedTreeSkillIds(character: FantasyCharacter): string[] {
  if (!character.classSkillTree) return []

  const unlockedSet = new Set<string>()
  const nodes = [...character.classSkillTree.nodes].sort((a, b) => a.tier - b.tier)

  for (const node of nodes) {
    const levelOk = character.level >= node.requiredLevel
    const prereqsOk = node.prerequisiteIds.every(id => unlockedSet.has(id))
    if (levelOk && prereqsOk) {
      unlockedSet.add(node.id)
    }
  }

  return Array.from(unlockedSet)
}
