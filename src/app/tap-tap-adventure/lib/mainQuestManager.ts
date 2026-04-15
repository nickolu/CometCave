import { MainQuest } from '@/app/tap-tap-adventure/models/quest'

// All conquerable regions (excludes starting_village which is a non-combat hub)
export const CONQUERABLE_REGIONS = [
  'green_meadows', 'dark_forest', 'crystal_caves', 'scorched_wastes',
  'frozen_peaks', 'shadow_realm', 'sky_citadel', 'sunken_ruins',
  'volcanic_forge', 'feywild_grove', 'bone_wastes', 'dragons_spine',
]

export const TOTAL_CONQUERABLE = CONQUERABLE_REGIONS.length // 12

const MILESTONES = [
  { regionsRequired: 3, title: 'First Frontiers', goldReward: 150 },
  { regionsRequired: 6, title: 'Halfway There', goldReward: 300 },
  { regionsRequired: 9, title: 'Almost Supreme', goldReward: 500 },
  { regionsRequired: TOTAL_CONQUERABLE, title: 'World Conqueror', goldReward: 1000 },
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

/** Check for newly reached milestones and return total gold to award. Mutates milestone claimed flags. */
export function claimNewMilestones(mainQuest: MainQuest, conqueredCount: number): number {
  let goldAwarded = 0
  for (const milestone of mainQuest.milestones) {
    if (!milestone.claimed && conqueredCount >= milestone.regionsRequired) {
      milestone.claimed = true
      goldAwarded += milestone.goldReward
    }
  }
  if (conqueredCount >= TOTAL_CONQUERABLE) {
    mainQuest.status = 'completed'
  }
  return goldAwarded
}
