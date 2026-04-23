import { Item, ItemEffects } from '@/app/tap-tap-adventure/models/item'

import { generateItemDescription } from './itemDescriptionGenerator'

interface KeywordRule {
  keywords: string[]
  effects: ItemEffects
}

const POTION_SUBRULES: KeywordRule[] = [
  { keywords: ['healing', 'health', 'life', 'restore', 'recovery'], effects: { heal: 10 } },
  { keywords: ['intelligence', 'wisdom', 'mind', 'knowledge', 'insight'], effects: { intelligence: 2 } },
  { keywords: ['luck', 'fortune', 'lucky', 'chance'], effects: { luck: 2 } },
  { keywords: ['strength', 'power', 'might', 'vigor', 'brawn'], effects: { strength: 3 } },
  { keywords: ['gold', 'wealth', 'rich', 'greed'], effects: { gold: 20 } },
  { keywords: ['shield', 'barrier', 'protection', 'ward', 'aegis'], effects: { shield: 15 } },
  { keywords: ['mana', 'arcane', 'ether', 'spirit', 'mystic'], effects: { manaRestore: 15 } },
  { keywords: ['antidote', 'cure', 'cleanse', 'purify', 'remedy'], effects: { cleanse: true } },
  { keywords: ['rage', 'fury', 'berserk', 'wrath', 'destruction'], effects: { damageBoost: 1.5 } },
]

const SCROLL_SUBRULES: KeywordRule[] = [
  { keywords: ['knowledge', 'wisdom', 'ancient'], effects: { intelligence: 2 } },
  { keywords: ['power', 'might', 'war', 'battle'], effects: { strength: 2 } },
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
  const inferred = inferItemTypeAndEffectsInternal(item)
  const withDescription = { ...inferred, description: generateItemDescription(inferred) }
  return withDescription.rarity ? withDescription : { ...withDescription, rarity: inferRarity(withDescription) }
}

function inferRarity(item: Item): Item['rarity'] {
  const name = item.name.toLowerCase()
  if (matchesAny(name, ['legendary', 'mythic', 'divine', 'godly'])) return 'legendary'
  if (matchesAny(name, ['epic', 'ancient', 'primordial', 'eternal'])) return 'epic'
  if (matchesAny(name, ['rare', 'enchanted', 'mystic', 'arcane'])) return 'rare'
  if (matchesAny(name, ['fine', 'quality', 'superior', 'sturdy', 'sharp', 'greater'])) return 'uncommon'
  return 'common'
}

function inferItemTypeAndEffectsInternal(item: Item): Item {
  const nameLower = item.name.toLowerCase()

  // Detect map/chart/atlas items: ensure revealLandmark effect is set
  if (matchesAny(nameLower, ['map', 'chart', 'atlas']) && item.type === 'consumable') {
    return {
      ...item,
      effects: { ...item.effects, revealLandmark: true },
    }
  }

  // Already fully specified
  if (item.type === 'consumable' && item.effects && Object.keys(item.effects).length > 0) {
    return item
  }

  // Spell scroll items — if it has a spell field, mark as spell_scroll
  if (item.type === 'spell_scroll' && item.spell) {
    return item
  }

  const name = nameLower

  // Detect spell scrolls by name pattern (when no type set and has spell data)
  if (!item.type || item.type === 'misc') {
    if (matchesAny(name, ['spell scroll', 'scroll of', 'tome of']) && item.spell) {
      return { ...item, type: 'spell_scroll' }
    }
  }

  // Potions / Elixirs
  if (matchesAny(name, ['potion', 'elixir', 'brew', 'tonic', 'vial', 'draught', 'flask'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? findMatchingEffects(name, POTION_SUBRULES, { heal: 5, intelligence: 1 }),
    }
  }

  // Scrolls / Tomes
  if (matchesAny(name, ['scroll', 'tome', 'manuscript', 'codex', 'grimoire'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? findMatchingEffects(name, SCROLL_SUBRULES, { intelligence: 1 }),
    }
  }

  // Food
  if (matchesAny(name, ['bread', 'meat', 'cheese', 'stew', 'ration', 'fruit', 'pie', 'cake', 'apple', 'berry', 'berries', 'mushroom', 'herb'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? { heal: 5 },
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

  // Bombs / Throwables
  if (matchesAny(name, ['bomb', 'grenade', 'explosive', 'firebomb', 'flashbang'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? { damageBoost: 1.5 },
    }
  }

  // Antidotes / Remedies
  if (matchesAny(name, ['antidote', 'remedy', 'panacea', 'salve'])) {
    return {
      ...item,
      type: 'consumable',
      effects: item.effects ?? { cleanse: true, heal: 5 },
    }
  }

  // Charms / Amulets (consumable by default, but equipment if explicitly typed)
  if (matchesAny(name, ['charm', 'amulet', 'talisman', 'trinket', 'lucky'])) {
    return {
      ...item,
      type: item.type === 'equipment' ? 'equipment' : 'consumable',
      effects: item.effects ?? { luck: 2 },
    }
  }

  // Equipment: Weapons
  if (
    matchesAny(name, [
      'sword', 'axe', 'dagger', 'bow', 'staff', 'blade', 'hammer', 'spear', 'mace', 'wand',
      'crossbow', 'scepter', 'polearm', 'whip', 'chain', 'halberd', 'lance', 'javelin', 'club',
      'fist',
    ])
  ) {
    const quality = matchesAny(name, ['greater', 'enchanted', 'legendary', 'mighty', 'ancient'])
      ? 3
      : matchesAny(name, ['fine', 'sharp', 'sturdy', 'steel'])
        ? 2
        : 1
    const weaponRange: 'close' | 'mid' | 'far' = matchesAny(name, [
      'bow', 'crossbow', 'wand', 'scepter', 'thrown', 'javelin',
    ])
      ? 'far'
      : matchesAny(name, ['spear', 'polearm', 'whip', 'chain', 'halberd', 'lance'])
        ? 'mid'
        : 'close'
    const baseEffects = item.effects ?? { strength: quality }
    return {
      ...item,
      type: 'equipment',
      effects: { ...baseEffects, range: baseEffects.range ?? weaponRange },
    }
  }

  // Equipment: Armor
  if (matchesAny(name, ['armor', 'shield', 'helm', 'helmet', 'boots', 'cloak', 'robe', 'plate', 'mail', 'gauntlet'])) {
    const quality = matchesAny(name, ['greater', 'enchanted', 'legendary', 'ancient']) ? 3
      : matchesAny(name, ['fine', 'reinforced', 'sturdy', 'steel']) ? 2 : 1
    return {
      ...item,
      type: 'equipment',
      effects: item.effects ?? { intelligence: quality },
    }
  }

  // Equipment: Accessories
  if (matchesAny(name, ['ring', 'necklace', 'bracelet', 'pendant', 'circlet', 'crown'])) {
    const quality = matchesAny(name, ['greater', 'enchanted', 'legendary', 'ancient']) ? 2 : 1
    return {
      ...item,
      type: 'equipment',
      effects: item.effects ?? { luck: quality },
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
      effects: { heal: 5, luck: 1 },
    }
  }

  return item
}
