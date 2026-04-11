import { Item } from '@/app/tap-tap-adventure/models/item'

export function generateItemDescription(item: Item): string {
  if (!item.effects || Object.keys(item.effects).length === 0) {
    return item.description // keep original if no effects
  }

  const parts: string[] = []
  const effects = item.effects

  if (effects.heal) parts.push(`Restores ${effects.heal} HP`)
  if (effects.strength) parts.push(`+${effects.strength} Strength`)
  if (effects.intelligence) parts.push(`+${effects.intelligence} Intelligence`)
  if (effects.luck) parts.push(`+${effects.luck} Luck`)
  if (effects.gold) parts.push(`+${effects.gold} Gold`)
  if (effects.reputation) parts.push(`+${effects.reputation} Reputation`)

  if (parts.length === 0) return item.description

  // Keep the original description's flavor text if it has one,
  // but append the accurate effects
  const effectText = parts.join(', ')

  // For consumables, format as the effects text
  if (item.type === 'consumable') {
    return `${effectText}`
  }

  // For equipment, format as "Grants [effects] when equipped"
  if (item.type === 'equipment') {
    return `${effectText} when equipped`
  }

  return effectText
}
