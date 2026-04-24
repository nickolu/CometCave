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
  // --- Potions & Consumables ---
  {
    id: 'mana_elixir',
    name: 'Mana Elixir',
    description: 'Distill two consumables into a concentrated mana potion.',
    ingredients: [{ type: 'consumable', quantity: 2 }],
    goldCost: 25,
    result: {
      name: 'Greater Mana Potion',
      description: 'A shimmering blue potion that restores a large amount of mana.',
      type: 'consumable',
      effects: { manaRestore: 25 },
    },
  },
  {
    id: 'battle_tonic',
    name: 'Battle Tonic',
    description: 'Brew a consumable with misc materials for a combat-boosting tonic.',
    ingredients: [
      { type: 'consumable', quantity: 1 },
      { type: 'misc', quantity: 1 },
    ],
    goldCost: 35,
    result: {
      name: 'Battle Tonic',
      description: 'A fiery tonic that temporarily boosts combat prowess.',
      type: 'consumable',
      effects: { damageBoost: 5, heal: 10 },
    },
  },
  {
    id: 'shield_potion',
    name: 'Shield Potion',
    description: 'Combine three consumables into a protective draught.',
    ingredients: [{ type: 'consumable', quantity: 3 }],
    goldCost: 40,
    result: {
      name: 'Iron Skin Draught',
      description: 'A thick metallic potion that creates a temporary magical barrier.',
      type: 'consumable',
      effects: { shield: 20 },
    },
  },
  {
    id: 'cleansing_brew',
    name: 'Cleansing Brew',
    description: 'Purify a consumable with misc materials to create a status-removing tonic.',
    ingredients: [
      { type: 'consumable', quantity: 1 },
      { type: 'misc', quantity: 2 },
    ],
    goldCost: 30,
    result: {
      name: 'Purification Tonic',
      description: 'A bitter brew that cleanses all negative status effects.',
      type: 'consumable',
      effects: { cleanse: 1, heal: 5 },
    },
  },
  // --- Equipment ---
  {
    id: 'arcane_staff',
    name: 'Arcane Staff',
    description: 'Fuse two spell scrolls with equipment to forge a powerful arcane weapon.',
    ingredients: [
      { type: 'spell_scroll', quantity: 2 },
      { type: 'equipment', quantity: 1 },
    ],
    goldCost: 120,
    result: {
      name: 'Staff of the Archmage',
      description: 'A crackling staff of pure arcane energy that greatly enhances spellcasting.',
      type: 'equipment',
      effects: { intelligence: 5, manaRestore: 5 },
    },
  },
  {
    id: 'berserker_gauntlets',
    name: "Berserker's Gauntlets",
    description: 'Forge two pieces of equipment into brutal gauntlets of raw power.',
    ingredients: [{ type: 'equipment', quantity: 2 }],
    goldCost: 90,
    result: {
      name: "Berserker's Gauntlets",
      description: 'Heavy gauntlets that channel fury into devastating blows.',
      type: 'equipment',
      effects: { strength: 5 },
    },
  },
  {
    id: 'diplomats_ring',
    name: "Diplomat's Ring",
    description: 'Combine a trade good with equipment to craft a ring of persuasion.',
    ingredients: [
      { type: 'trade_good', quantity: 1 },
      { type: 'equipment', quantity: 1 },
    ],
    goldCost: 70,
    result: {
      name: "Diplomat's Ring",
      description: 'An elegant ring that enhances charisma and reputation.',
      type: 'equipment',
      effects: { charisma: 3, reputation: 2 },
    },
  },
  {
    id: 'fortified_shield',
    name: 'Fortified Shield',
    description: 'Combine equipment with misc materials into a reinforced shield.',
    ingredients: [
      { type: 'equipment', quantity: 1 },
      { type: 'misc', quantity: 2 },
    ],
    goldCost: 65,
    result: {
      name: 'Bulwark Shield',
      description: 'A massive reinforced shield that provides excellent protection.',
      type: 'equipment',
      effects: { strength: 2, shield: 10 },
    },
  },
  // --- Trade & Profit ---
  {
    id: 'golden_idol',
    name: 'Golden Idol',
    description: 'Combine three trade goods into a valuable golden idol for sale.',
    ingredients: [{ type: 'trade_good', quantity: 3 }],
    goldCost: 15,
    result: {
      name: 'Golden Idol',
      description: 'An exquisitely crafted golden idol worth a small fortune.',
      type: 'trade_good',
      effects: { gold: 100 },
    },
  },
  {
    id: 'merchant_bundle',
    name: 'Merchant Bundle',
    description: 'Package two trade goods into a premium merchant bundle.',
    ingredients: [{ type: 'trade_good', quantity: 2 }],
    goldCost: 10,
    result: {
      name: 'Premium Goods Bundle',
      description: 'A neatly packaged bundle of fine goods that fetches a good price.',
      type: 'trade_good',
      effects: { gold: 50, reputation: 1 },
    },
  },
  // --- Hybrid & Special ---
  {
    id: 'war_scroll',
    name: 'War Scroll',
    description: 'Infuse a spell scroll with misc materials to amplify its combat power.',
    ingredients: [
      { type: 'spell_scroll', quantity: 1 },
      { type: 'misc', quantity: 1 },
    ],
    goldCost: 55,
    result: {
      name: 'Empowered War Scroll',
      description: 'A scroll crackling with amplified combat magic.',
      type: 'spell_scroll',
      effects: { strength: 2, intelligence: 2 },
    },
  },
  {
    id: 'phoenix_salve',
    name: 'Phoenix Salve',
    description: 'An advanced recipe requiring rare materials to create the ultimate healing item.',
    ingredients: [
      { type: 'consumable', quantity: 2 },
      { type: 'misc', quantity: 2 },
    ],
    goldCost: 80,
    result: {
      name: 'Phoenix Salve',
      description: 'A legendary salve that heals devastating wounds and restores mana.',
      type: 'consumable',
      effects: { heal: 60, manaRestore: 15 },
    },
  },
  {
    id: 'wanderer_boots',
    name: "Wanderer's Boots",
    description: 'Combine equipment with trade goods to craft swift travel boots.',
    ingredients: [
      { type: 'equipment', quantity: 1 },
      { type: 'trade_good', quantity: 1 },
    ],
    goldCost: 75,
    result: {
      name: "Wanderer's Boots",
      description: 'Lightweight boots enchanted for swift travel and good fortune.',
      type: 'equipment',
      effects: { luck: 3, charisma: 1 },
    },
  },
  {
    id: 'alchemists_kit',
    name: "Alchemist's Kit",
    description: 'Combine four consumables to create an all-purpose alchemist kit.',
    ingredients: [{ type: 'consumable', quantity: 4 }],
    goldCost: 50,
    result: {
      name: "Master Alchemist's Kit",
      description: 'A comprehensive kit of potions and salves for any situation.',
      type: 'consumable',
      effects: { heal: 40, manaRestore: 20, shield: 10 },
    },
  },
]
