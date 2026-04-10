import { Item } from '@/app/tap-tap-adventure/models/item'

/**
 * Calculate the sell price for an item.
 * - If the item has an explicit `price`, sell for 50% of that.
 * - Otherwise, derive a price from item type and effects:
 *   - Equipment: 10 + sum(effects) * 5
 *   - Consumable: 5 + sum(effects) * 3
 *   - Other / no type: 3
 */
export function calculateSellPrice(item: Item): number {
  if (item.price != null && item.price > 0) {
    return Math.floor(item.price * 0.5)
  }

  const effectSum = sumEffects(item)

  switch (item.type) {
    case 'equipment':
      return 10 + effectSum * 5
    case 'consumable':
      return 5 + effectSum * 3
    default:
      return 3
  }
}

function sumEffects(item: Item): number {
  if (!item.effects) return 0
  const { strength, intelligence, luck, gold, reputation } = item.effects
  return (strength ?? 0) + (intelligence ?? 0) + (luck ?? 0) + (gold ?? 0) + (reputation ?? 0)
}
