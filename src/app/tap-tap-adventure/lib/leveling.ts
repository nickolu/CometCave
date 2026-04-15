import { CLASS_SPELL_CONFIG } from '@/app/tap-tap-adventure/config/characterOptions'
import { getDifficultyModifiers } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getMountMaxHp } from '@/app/tap-tap-adventure/config/mounts'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Skill } from '@/app/tap-tap-adventure/models/skill'
import { getSkillBonus } from '@/app/tap-tap-adventure/lib/skillTracker'
import type { MetaBonuses } from '@/app/tap-tap-adventure/lib/metaProgressionBonuses'

/** Resolve unlocked Skill objects from the character's stored skill IDs. */
function resolveSkills(character: FantasyCharacter): Skill[] {
  const ids = character.unlockedSkills ?? []
  return SKILLS.filter(s => ids.includes(s.id))
}

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
 * Applies passive skill bonuses (e.g. Thick Skin +10% max HP, Veteran +1 all stats).
 */
export function calculateMaxHp(character: FantasyCharacter): number {
  const skills = resolveSkills(character)
  const hpBonus = getSkillBonus(skills, 'maxHp')
  const allStatsBonus = getSkillBonus(skills, 'all_stats')
  const effectiveStr = character.strength + allStatsBonus.flat
  const base = 30 + effectiveStr * 3 + character.level * 8
  return Math.floor(base * (1 + hpBonus.percentage / 100))
}

/**
 * Calculate max mana for a character based on stats and class.
 * Applies passive skill bonuses (e.g. Mana Well +20% max mana).
 */
export function calculateMaxMana(character: FantasyCharacter): number {
  const skills = resolveSkills(character)
  const manaBonus = getSkillBonus(skills, 'maxMana')
  const allStatsBonus = getSkillBonus(skills, 'all_stats')
  const effectiveInt = (character.intelligence ?? 5) + allStatsBonus.flat
  const base = 20 + effectiveInt * 3 + (character.level ?? 1) * 5
  // Use classData manaMultiplier if available, otherwise fall back to static config
  const manaMultiplier = character.classData?.manaMultiplier
    ?? CLASS_SPELL_CONFIG[character.class.toLowerCase()]?.manaMultiplier
    ?? 1
  return Math.floor(base * manaMultiplier * (1 + manaBonus.percentage / 100))
}

const MANA_REGEN_BASE_RATE = 5 // base: 1 mana every 5 steps
const HEAL_RATE = 10 // heal 1 HP every N steps

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
  stepsGained: number = 1,
  metaBonuses?: MetaBonuses
): FantasyCharacter {
  // Apply XP multiplier from meta bonuses: effectively increase distance for level calculation
  const xpMultiplier = metaBonuses?.xpMultiplier ?? 1
  const effectiveDistance = Math.floor(character.distance * xpMultiplier)
  const newLevel = calculateLevel(effectiveDistance)
  let updated = { ...character }

  const leveledUp = newLevel > character.level

  if (leveledUp) {
    const levelsGained = newLevel - character.level
    updated = {
      ...updated,
      level: newLevel,
      pendingStatPoints: (character.pendingStatPoints ?? 0) + levelsGained * STAT_POINTS_PER_LEVEL,
    }
  } else if (newLevel < character.level) {
    updated.level = newLevel
  }

  // Update maxHp and maxMana
  const maxHp = calculateMaxHp(updated)
  const maxMana = calculateMaxMana(updated)

  // Level up: full heal HP and mana
  if (leveledUp) {
    return {
      ...updated,
      hp: maxHp,
      maxHp,
      mana: maxMana,
      maxMana,
    }
  }

  // Normal walking: slow regen using distance-based thresholds
  // Uses floor(newDist/rate) - floor(oldDist/rate) so single-step increments work
  const oldDistance = updated.distance - stepsGained
  const currentHp = updated.hp ?? maxHp
  const mountHealBonus = (updated.activeMount?.bonuses?.healRate ?? 0) + (updated.activeMount?.personality === 'gentle' ? 1 : 0)
  const skills = resolveSkills(updated)
  const healSkillBonus = getSkillBonus(skills, 'heal_rate')
  const diffMods = getDifficultyModifiers(updated.difficultyMode)
  const healTicks = Math.floor(updated.distance / HEAL_RATE) - Math.floor(oldDistance / HEAL_RATE)
  const metaHealMultiplier = metaBonuses?.healRateMultiplier ?? 1
  const baseHeal = Math.max(0, healTicks) * (1 + healSkillBonus.flat) + (healTicks > 0 ? mountHealBonus : 0)
  const healed = Math.min(maxHp, currentHp + Math.round(baseHeal * diffMods.healRateMultiplier * metaHealMultiplier))

  // Mount HP healing while traveling
  if (updated.activeMount && healTicks > 0 && updated.activeMount.hp !== undefined && updated.activeMount.maxHp !== undefined) {
    const mountMaxHp = updated.activeMount.maxHp
    const mountHealAmount = 1
    const newMountHp = Math.min(mountMaxHp, (updated.activeMount.hp ?? mountMaxHp) + mountHealAmount)
    updated = { ...updated, activeMount: { ...updated.activeMount, hp: newMountHp } }
  }

  const classConfig = CLASS_SPELL_CONFIG[updated.class.toLowerCase()]
  const regenMultiplier = classConfig?.regenMultiplier ?? 1
  const effectiveRegenRate = Math.max(1, Math.floor(MANA_REGEN_BASE_RATE / regenMultiplier))
  const currentMana = updated.mana ?? maxMana
  const manaTicks = Math.floor(updated.distance / effectiveRegenRate) - Math.floor(oldDistance / effectiveRegenRate)
  const regenedMana = Math.min(maxMana, currentMana + Math.max(0, manaTicks))

  return {
    ...updated,
    hp: healed,
    maxHp,
    mana: regenedMana,
    maxMana,
  }
}
