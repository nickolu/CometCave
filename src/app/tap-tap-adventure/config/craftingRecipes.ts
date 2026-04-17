import { Item, ItemEffects } from '@/app/tap-tap-adventure/models/item'

export type RecipeIngredient = {
  type: Item['type']
  quantity: number
}

export type CraftingRecipe = {
  id: string
  name: string
  description: string
  ingredients: RecipeIngredient[]
  goldCost: number
  result: {
    name: string
    description: string
    type: Item['type']
    effects: ItemEffects
  }
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'healing_salve',
    name: 'Healing Salve',
    description: 'Combine two consumables to create a powerful healing potion.',
    ingredients: [{ type: 'consumable', quantity: 2 }],
    goldCost: 20,
    result: {
      name: 'Greater Healing Potion',
      description: 'A potent brew that restores a large amount of health.',
      type: 'consumable',
      effects: { heal: 30 },
    },
  },
  {
    id: 'reinforced_weapon',
    name: 'Reinforced Weapon',
    description: 'Combine a weapon with misc materials to enhance its power.',
    ingredients: [
      { type: 'equipment', quantity: 1 },
      { type: 'misc', quantity: 1 },
    ],
    goldCost: 50,
    result: {
      name: 'Enhanced Blade',
      description: 'A blade reinforced with rare materials, granting increased strength.',
      type: 'equipment',
      effects: { strength: 3 },
    },
  },
  {
    id: 'warded_armor',
    name: 'Warded Armor',
    description: 'Infuse armor with a consumable to create enchanted protection.',
    ingredients: [
      { type: 'equipment', quantity: 1 },
      { type: 'consumable', quantity: 1 },
    ],
    goldCost: 60,
    result: {
      name: 'Enchanted Armor',
      description: 'Armor imbued with protective magic, boosting both strength and intelligence.',
      type: 'equipment',
      effects: { strength: 2, intelligence: 2 },
    },
  },
  {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    description: 'Combine two pieces of equipment to forge a talisman of fortune.',
    ingredients: [{ type: 'equipment', quantity: 2 }],
    goldCost: 40,
    result: {
      name: 'Lucky Charm',
      description: 'A charm brimming with luck that brings fortune to its bearer.',
      type: 'equipment',
      effects: { luck: 3 },
    },
  },
  {
    id: 'spell_tome',
    name: 'Spell Tome',
    description: 'Merge two spell scrolls into a tome of arcane knowledge.',
    ingredients: [{ type: 'spell_scroll', quantity: 2 }],
    goldCost: 75,
    result: {
      name: 'Master Spell Tome',
      description: 'A tome containing distilled arcane wisdom, greatly boosting intelligence.',
      type: 'equipment',
      effects: { intelligence: 3 },
    },
  },
  {
    id: 'survival_kit',
    name: 'Survival Kit',
    description: 'Combine three consumables into an adventurer\'s survival pack.',
    ingredients: [{ type: 'consumable', quantity: 3 }],
    goldCost: 30,
    result: {
      name: "Adventurer's Pack",
      description: 'A well-stocked pack with supplies that heals and brings a touch of luck.',
      type: 'consumable',
      effects: { heal: 50, luck: 1 },
    },
  },
  {
    id: 'shadow_blade',
    name: 'Shadow Blade',
    description: 'Infuse a weapon with a spell scroll to forge a shadow-touched blade.',
    ingredients: [
      { type: 'equipment', quantity: 1 },
      { type: 'spell_scroll', quantity: 1 },
    ],
    goldCost: 100,
    result: {
      name: 'Shadow-Forged Blade',
      description: 'A blade wreathed in shadow magic, granting great strength and fortune.',
      type: 'equipment',
      effects: { strength: 4, luck: 1 },
    },
  },
  {
    id: 'crystal_focus',
    name: 'Crystal Focus',
    description: 'Attune a piece of equipment with a spell scroll to create an arcane focus.',
    ingredients: [
      { type: 'equipment', quantity: 1 },
      { type: 'spell_scroll', quantity: 1 },
    ],
    goldCost: 80,
    result: {
      name: 'Arcane Crystal',
      description: 'A crystalline focus that greatly amplifies arcane power.',
      type: 'equipment',
      effects: { intelligence: 5 },
    },
  },
]
