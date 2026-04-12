import { ETERNAL_UPGRADES } from '@/app/tap-tap-adventure/config/eternalUpgrades'

export interface MetaBonuses {
  bonusHp: number
  bonusStrength: number
  bonusIntelligence: number
  bonusLuck: number
  bonusGold: number
  bonusMana: number
  healRateMultiplier: number
  xpMultiplier: number
  shopDiscount: number
  lootBonusChance: number
}

const ZERO_BONUSES: MetaBonuses = {
  bonusHp: 0,
  bonusStrength: 0,
  bonusIntelligence: 0,
  bonusLuck: 0,
  bonusGold: 0,
  bonusMana: 0,
  healRateMultiplier: 1,
  xpMultiplier: 1,
  shopDiscount: 0,
  lootBonusChance: 0,
}

/**
 * Calculate aggregate bonuses from all purchased eternal upgrades.
 */
export function getMetaBonuses(upgradeLevels: Record<string, number>): MetaBonuses {
  const bonuses = { ...ZERO_BONUSES }

  for (const upgrade of ETERNAL_UPGRADES) {
    const level = upgradeLevels[upgrade.id] ?? 0
    if (level <= 0) continue

    const effects = upgrade.effects
    bonuses.bonusHp += (effects.bonusHp ?? 0) * level
    bonuses.bonusStrength += (effects.bonusStrength ?? 0) * level
    bonuses.bonusIntelligence += (effects.bonusIntelligence ?? 0) * level
    bonuses.bonusLuck += (effects.bonusLuck ?? 0) * level
    bonuses.bonusGold += (effects.bonusGold ?? 0) * level
    bonuses.bonusMana += (effects.bonusMana ?? 0) * level
    // healRateMultiplier and xpMultiplier are percentage-based; accumulate then convert
    bonuses.healRateMultiplier += (effects.healRateMultiplier ?? 0) * level / 100
    bonuses.xpMultiplier += (effects.xpMultiplier ?? 0) * level / 100
    bonuses.shopDiscount += (effects.shopDiscount ?? 0) * level
    bonuses.lootBonusChance += (effects.lootBonusChance ?? 0) * level
  }

  return bonuses
}
