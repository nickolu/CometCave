import type { Item } from '@/app/tap-tap-adventure/models/item'

export const ENCHANT_COSTS = [50, 100, 175, 275, 400] // cost for levels 1-5
export const MAX_ENCHANT_LEVEL = 5

export function getEnchantCost(currentLevel: number): number | null {
  if (currentLevel >= MAX_ENCHANT_LEVEL) return null
  return ENCHANT_COSTS[currentLevel] ?? null
}

/**
 * Returns the stat key with the highest value in item.effects, or null if no
 * numeric stat effects exist. Only considers strength, intelligence, and luck.
 */
export function getEnchantBonusStat(item: Item): 'strength' | 'intelligence' | 'luck' | null {
  const effects = item.effects
  if (!effects) return null

  const all: Array<{ stat: 'strength' | 'intelligence' | 'luck'; value: number }> = [
    { stat: 'strength', value: effects.strength ?? 0 },
    { stat: 'intelligence', value: effects.intelligence ?? 0 },
    { stat: 'luck', value: effects.luck ?? 0 },
  ]
  const candidates = all.filter(c => c.value > 0)

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.value - a.value)
  return candidates[0].stat
}
