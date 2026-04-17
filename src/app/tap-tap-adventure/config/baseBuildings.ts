export interface BaseBuilding {
  id: string
  name: string
  description: string
  icon: string
  maxLevel: number
  costPerLevel: number[]
  effectDescription: string
}

export interface CampBonuses {
  goldEventBonusPct: number
  bonusStrength: number
  bonusIntelligence: number
  reputationGainBonusPct: number
  mountUpkeepDiscountPct: number
  combatSuccessBonus: number
}

export const BASE_BUILDINGS: BaseBuilding[] = [
  {
    id: 'tavern',
    name: 'Tavern',
    description: 'A lively inn where tales of fortune are shared.',
    icon: '\uD83C\uDF7A',
    maxLevel: 3,
    costPerLevel: [50, 150, 400],
    effectDescription: '+5% gold from events per level',
  },
  {
    id: 'armory',
    name: 'Armory',
    description: 'Weapons and training to strengthen your fighters.',
    icon: '\u2694\uFE0F',
    maxLevel: 3,
    costPerLevel: [75, 200, 500],
    effectDescription: '+1 Strength per level',
  },
  {
    id: 'library',
    name: 'Library',
    description: 'Ancient tomes that sharpen the mind.',
    icon: '\uD83D\uDCDA',
    maxLevel: 3,
    costPerLevel: [75, 200, 500],
    effectDescription: '+1 Intelligence per level',
  },
  {
    id: 'shrine',
    name: 'Shrine',
    description: 'A sacred place that improves your standing with locals.',
    icon: '\uD83D\uDD6F\uFE0F',
    maxLevel: 3,
    costPerLevel: [60, 175, 450],
    effectDescription: '+5% reputation gain per level',
  },
  {
    id: 'stable',
    name: 'Stable',
    description: 'Quality care for your mounts reduces their daily cost.',
    icon: '\uD83D\uDC34',
    maxLevel: 3,
    costPerLevel: [80, 225, 550],
    effectDescription: '-20% mount upkeep per level',
  },
  {
    id: 'watchtower',
    name: 'Watchtower',
    description: 'A vantage point that improves tactical awareness in combat.',
    icon: '\uD83D\uDDFC',
    maxLevel: 3,
    costPerLevel: [100, 250, 600],
    effectDescription: '+5% combat success per level',
  },
]

export function getBuildingById(id: string): BaseBuilding | undefined {
  return BASE_BUILDINGS.find(b => b.id === id)
}

export function getCampBonuses(buildingLevels: Record<string, number>): CampBonuses {
  const bonuses: CampBonuses = {
    goldEventBonusPct: 0,
    bonusStrength: 0,
    bonusIntelligence: 0,
    reputationGainBonusPct: 0,
    mountUpkeepDiscountPct: 0,
    combatSuccessBonus: 0,
  }

  for (const building of BASE_BUILDINGS) {
    const level = buildingLevels[building.id] ?? 0
    if (level <= 0) continue

    switch (building.id) {
      case 'tavern':
        bonuses.goldEventBonusPct += 5 * level
        break
      case 'armory':
        bonuses.bonusStrength += 1 * level
        break
      case 'library':
        bonuses.bonusIntelligence += 1 * level
        break
      case 'shrine':
        bonuses.reputationGainBonusPct += 5 * level
        break
      case 'stable':
        bonuses.mountUpkeepDiscountPct += 20 * level
        break
      case 'watchtower':
        bonuses.combatSuccessBonus += 0.05 * level
        break
    }
  }

  return bonuses
}
