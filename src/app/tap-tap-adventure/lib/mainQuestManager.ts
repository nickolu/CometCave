import { MainQuest } from '@/app/tap-tap-adventure/models/quest'

// All conquerable regions
export const CONQUERABLE_REGIONS = [
  'green_meadows', 'dark_forest', 'crystal_caves', 'scorched_wastes',
  'frozen_peaks', 'shadow_realm', 'sky_citadel', 'sunken_ruins',
  'volcanic_forge', 'feywild_grove', 'bone_wastes', 'dragons_spine',
  'abyssal_depths', 'celestial_throne',
]

export const TOTAL_CONQUERABLE = CONQUERABLE_REGIONS.length // 14

const MILESTONES = [
  { regionsRequired: 3, title: 'First Frontiers', goldReward: 150 },
  { regionsRequired: 6, title: 'Halfway There', goldReward: 300 },
  { regionsRequired: 9, title: 'Almost Supreme', goldReward: 500 },
  { regionsRequired: 12, title: 'World Conqueror', goldReward: 1000 },
  { regionsRequired: TOTAL_CONQUERABLE, title: 'World Domination', goldReward: 2000 },
]

export function createMainQuest(): MainQuest {
  return {
    title: 'Conquer the World',
    description: 'Defeat every region boss guardian and unite the lands under your banner.',
    status: 'active',
    milestones: MILESTONES.map(m => ({ ...m, claimed: false })),
  }
}

export function getConqueredCount(visitedRegions: string[]): number {
  return visitedRegions.filter(r => CONQUERABLE_REGIONS.includes(r)).length
}

/**
 * Claim every milestone the conquered count has reached. Returns the quest
 * with those milestones claimed (and completed when all regions are taken)
 * plus the gold they award. Does not touch the quest it is given: the store's
 * objects are frozen, and writing into one throws.
 */
export function claimNewMilestones(mainQuest: MainQuest, conqueredCount: number): { mainQuest: MainQuest; goldAwarded: number } {
  let goldAwarded = 0
  const milestones = mainQuest.milestones.map(milestone => {
    if (!milestone.claimed && conqueredCount >= milestone.regionsRequired) {
      goldAwarded += milestone.goldReward
      return { ...milestone, claimed: true }
    }
    return milestone
  })
  const status = conqueredCount >= TOTAL_CONQUERABLE ? 'completed' : mainQuest.status
  return { mainQuest: { ...mainQuest, milestones, status }, goldAwarded }
}
