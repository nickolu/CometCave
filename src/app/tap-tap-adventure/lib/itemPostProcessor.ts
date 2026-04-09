import { Item, ItemEffects } from '@/app/tap-tap-adventure/models/item'

interface KeywordRule {
  keywords: string[]
  effects: ItemEffects
}

const POTION_SUBRULES: KeywordRule[] = [
  { keywords: ['healing', 'health', 'life', 'restore', 'recovery'], effects: { strength: 2 } },
  { keywords: ['intelligence', 'wisdom', 'mind', 'knowledge', 'insight'], effects: { intelligence: 2 } },
  { keywords: ['luck', 'fortune', 'lucky', 'chance'], effects: { luck: 2 } },
  { keywords: ['strength', 'power', 'might', 'vigor', 'brawn'], effects: { strength: 3 } },
  { keywords: ['gold', 'wealth', 'rich', 'greed'], effects: { gold: 20 } },
]

const SCROLL_SUBRULES: KeywordRule[] = [
  { keywords: ['knowledge', 'wisdom', 'ancient'], effects: { xp: 50, intelligence: 1 } },
  { keywords: ['power', 'might', 'war', 'battle'], effects: { xp: 30, strength: 1 } },
]

function matchesAny(name: string, keywords: string[]): boolean {
  return keywords.some(k => name.includes(k))
}

function findMatchingEffects(name: string, rules: KeywordRule[], fallback: ItemEffects): ItemEffects {
  for (const rule of rules) {
    if (matchesAny(name, rule.keywords)) {
      return rule.effects
    }
  }
  return fallback
}

export function inferItemTypeAndEffects(item: Item): Item {
  // Already fully specified
  if (item.type === 'consumable' && item.effects && Object.keys(item.effects).length > 0) {
    return item
  }

  const name = item.name.toLowerCase()

  // Potions / Elixirs
  if (matchesAny(name, ['potion', 'elixir', 'brew', 'tonic', 'vial', 'draught', 'flask'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? findMatchingEffects(name, POTION_SUBRULES, { strength: 1, intelligence: 1 }),
    }
  }

  // Scrolls / Tomes
  if (matchesAny(name, ['scroll', 'tome', 'manuscript', 'codex', 'grimoire'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? findMatchingEffects(name, SCROLL_SUBRULES, { xp: 30 }),
    }
  }

  // Food
  if (matchesAny(name, ['bread', 'meat', 'cheese', 'stew', 'ration', 'fruit', 'pie', 'cake', 'apple', 'berry', 'berries', 'mushroom', 'herb'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? { strength: 1 },
    }
  }

  // Coins / Gems
  if (matchesAny(name, ['diamond', 'emerald', 'sapphire', 'ruby'])) {
    return { ...item, type: 'consumable', effects: item.effects ?? { gold: 50 } }
  }
  if (matchesAny(name, ['gem', 'jewel'])) {
    return { ...item, type: 'consumable', effects: item.effects ?? { gold: 25 } }
  }
  if (matchesAny(name, ['coin', 'gold piece', 'gold pouch'])) {
    return { ...item, type: 'consumable', effects: item.effects ?? { gold: 15 } }
  }

  // Charms / Amulets
  if (matchesAny(name, ['charm', 'amulet', 'talisman', 'trinket', 'lucky'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? { luck: 2 },
    }
  }

  // Has effects but missing type
  if (item.effects && Object.keys(item.effects).length > 0) {
    return { ...item, type: 'consumable' }
  }

  // Has consumable type but missing effects — try to infer
  if (item.type === 'consumable') {
    return {
      ...item,
      effects: { strength: 1, luck: 1 },
    }
  }

  return item
}
