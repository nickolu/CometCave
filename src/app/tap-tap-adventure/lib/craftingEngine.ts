import { CraftingRecipe } from '@/app/tap-tap-adventure/config/craftingRecipes'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'

/**
 * Check whether a character can craft the given recipe.
 * Counts active (non-deleted) items by type, summing quantities.
 */
export function canCraft(
  recipe: CraftingRecipe,
  inventory: Item[],
  gold: number
): boolean {
  if (gold < recipe.goldCost) return false

  for (const ingredient of recipe.ingredients) {
    const available = inventory
      .filter(item => item.status !== 'deleted' && item.type === ingredient.type)
      .reduce((sum, item) => sum + (item.quantity ?? 1), 0)

    if (available < ingredient.quantity) return false
  }

  return true
}

/**
 * Apply a crafting recipe to a character.
 * Greedily consumes matching items from inventory (decrementing quantity,
 * soft-deleting items that reach 0), deducts gold, and adds the crafted item.
 *
 * Assumes canCraft() returned true before calling this.
 */
export function applyCraft(
  character: FantasyCharacter,
  recipe: CraftingRecipe
): FantasyCharacter {
  // Clone inventory so we don't mutate
  let updatedInventory: Item[] = character.inventory.map(item => ({ ...item }))

  // For each ingredient type, greedily consume items
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.quantity

    for (const item of updatedInventory) {
      if (remaining <= 0) break
      if (item.status === 'deleted' || item.type !== ingredient.type) continue

      const qty = item.quantity ?? 1
      if (qty <= remaining) {
        remaining -= qty
        item.quantity = 0
        item.status = 'deleted'
      } else {
        item.quantity = qty - remaining
        remaining = 0
      }
    }
  }

  // Build the crafted item
  const craftedItem: Item = {
    id: `crafted_${recipe.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: recipe.result.name,
    description: recipe.result.description,
    type: recipe.result.type,
    effects: recipe.result.effects,
    quantity: 1,
    status: 'active',
  }

  updatedInventory = [...updatedInventory, craftedItem]

  return {
    ...character,
    gold: character.gold - recipe.goldCost,
    inventory: updatedInventory,
  }
}
