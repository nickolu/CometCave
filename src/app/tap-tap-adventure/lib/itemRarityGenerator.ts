import { Item } from '@/app/tap-tap-adventure/models/item'

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/** Stat multipliers indexed by rarity */
export const RARITY_STAT_MULTIPLIERS: Record<ItemRarity, number> = {
  common: 1.0,
  uncommon: 1.2,
  rare: 1.5,
  epic: 2.0,
  legendary: 3.0,
}

/** Price multipliers indexed by rarity */
export const RARITY_PRICE_MULTIPLIERS: Record<ItemRarity, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.5,
  epic: 5.0,
  legendary: 15.0,
}

// ---------------------- Rarity roll tables ----------------------

const RARITY_TABLES: Record<string, Array<{ rarity: ItemRarity; weight: number }>> = {
  regular: [
    { rarity: 'common', weight: 0.55 },
    { rarity: 'uncommon', weight: 0.28 },
    { rarity: 'rare', weight: 0.12 },
    { rarity: 'epic', weight: 0.04 },
    { rarity: 'legendary', weight: 0.01 },
  ],
  boss: [
    { rarity: 'common', weight: 0.0 },
    { rarity: 'uncommon', weight: 0.2 },
    { rarity: 'rare', weight: 0.4 },
    { rarity: 'epic', weight: 0.3 },
    { rarity: 'legendary', weight: 0.1 },
  ],
  miniboss: [
    { rarity: 'common', weight: 0.1 },
    { rarity: 'uncommon', weight: 0.3 },
    { rarity: 'rare', weight: 0.4 },
    { rarity: 'epic', weight: 0.15 },
    { rarity: 'legendary', weight: 0.05 },
  ],
  shop: [
    { rarity: 'common', weight: 0.45 },
    { rarity: 'uncommon', weight: 0.35 },
    { rarity: 'rare', weight: 0.15 },
    { rarity: 'epic', weight: 0.04 },
    { rarity: 'legendary', weight: 0.01 },
  ],
  landmark: [
    { rarity: 'common', weight: 0.2 },
    { rarity: 'uncommon', weight: 0.35 },
    { rarity: 'rare', weight: 0.3 },
    { rarity: 'epic', weight: 0.12 },
    { rarity: 'legendary', weight: 0.03 },
  ],
  npc: [
    { rarity: 'common', weight: 0.4 },
    { rarity: 'uncommon', weight: 0.35 },
    { rarity: 'rare', weight: 0.2 },
    { rarity: 'epic', weight: 0.04 },
    { rarity: 'legendary', weight: 0.01 },
  ],
}

/**
 * Roll a rarity for an item based on its source and the player's luck stat.
 * Higher luck shifts the distribution toward rarer outcomes.
 */
export function rollRarityForSource(
  source: 'regular' | 'boss' | 'miniboss' | 'shop' | 'landmark' | 'npc',
  luck: number
): ItemRarity {
  const table = RARITY_TABLES[source] ?? RARITY_TABLES.regular

  // Luck bonus: each luck point adds a small shift toward rarer items
  const luckBonus = Math.min(luck * 0.002, 0.15) // cap at +15% total shift

  // Shift weight from common -> legendary based on luck
  const adjusted = table.map((entry, i) => {
    if (i === 0) {
      // Reduce common chance by luck bonus amount
      return { rarity: entry.rarity, weight: Math.max(0, entry.weight - luckBonus) }
    }
    if (i === table.length - 1) {
      // Add all removed weight to legendary
      return { rarity: entry.rarity, weight: entry.weight + luckBonus }
    }
    return entry
  })

  // Roll
  const roll = Math.random()
  let cumulative = 0
  for (const entry of adjusted) {
    cumulative += entry.weight
    if (roll < cumulative) return entry.rarity
  }
  return 'common'
}

// ---------------------- Effect pools ----------------------

const ON_HIT_EFFECT_POOL: Array<NonNullable<Item['onHitEffect']>> = [
  { type: 'poison', chance: 0.25, damage: 3, duration: 3, description: 'Poisons the target, dealing damage over time' },
  { type: 'burn', chance: 0.20, damage: 4, duration: 2, description: 'Burns the target, dealing fire damage over time' },
  { type: 'bleed', chance: 0.30, damage: 2, duration: 4, description: 'Inflicts bleeding, causing continuous damage' },
  { type: 'freeze', chance: 0.20, damage: 0, duration: 2, description: 'Freezes the target, reducing their attack' },
  { type: 'stun', chance: 0.15, damage: 0, duration: 1, description: 'Stuns the target, skipping their next action' },
  { type: 'lifesteal', chance: 0.35, damage: 0, duration: 0, description: 'Drains life from the enemy, healing you' },
]

const PASSIVE_EFFECT_POOL: Array<NonNullable<Item['passiveEffect']>> = [
  { type: 'crit_bonus', value: 0.05, description: '+5% critical strike chance' },
  { type: 'crit_bonus', value: 0.10, description: '+10% critical strike chance' },
  { type: 'dodge', value: 0.08, description: '8% chance to dodge incoming attacks' },
  { type: 'dodge', value: 0.12, description: '12% chance to dodge incoming attacks' },
  { type: 'lifesteal_passive', value: 0.05, description: 'Heals 5% of damage dealt' },
  { type: 'lifesteal_passive', value: 0.10, description: 'Heals 10% of damage dealt' },
  { type: 'thorns', value: 3, description: 'Returns 3 damage to attackers' },
  { type: 'thorns', value: 5, description: 'Returns 5 damage to attackers' },
  { type: 'poison_immunity', value: 1, description: 'Immune to poison effects' },
  { type: 'burn_immunity', value: 1, description: 'Immune to burn effects' },
  { type: 'hp_regen', value: 2, description: 'Regenerates 2 HP per turn' },
  { type: 'loot_bonus', value: 0.1, description: '+10% item drop chance' },
]

const DRAWBACK_POOL: Array<NonNullable<Item['drawback']>> = [
  { stat: 'luck', value: -2, description: 'Reduces luck' },
  { stat: 'intelligence', value: -2, description: 'Dulls the mind' },
  { stat: 'strength', value: -1, description: 'Weighs you down slightly' },
  { stat: 'charisma', value: -3, description: 'Makes you appear threatening' },
  { stat: 'luck', value: -3, description: 'Cursed with bad fortune' },
  { stat: 'intelligence', value: -3, description: 'Clouds your judgment' },
]

const LORE_TEMPLATES: string[] = [
  'This item whispers of ancient battles long forgotten.',
  'Forged in the fires of a dying star, or so the legend goes.',
  'Once wielded by a hero whose name has been lost to time.',
  'The enchantment pulses with a warmth that defies explanation.',
  'Merchants refuse to speak its true name for fear of ill omens.',
  'It is said this item chose its bearer, not the other way around.',
  'Runes etched into its surface glow faintly under moonlight.',
  'A cartographer once traded an entire map empire for this.',
  'Scholars debate its origin; warriors simply call it effective.',
  'The craftsmanship suggests a civilization that no longer exists.',
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Given an item and its rarity, add appropriate effects based on rarity tier.
 * - uncommon+: may add onHitEffect
 * - rare+: may add passiveEffect and loreText
 * - epic+: may add drawback
 */
export function generateRarityEffects(item: Item, rarity: ItemRarity): Item {
  let updated = { ...item, rarity }

  // Only equipment items get combat effects
  if (item.type !== 'equipment') return updated

  switch (rarity) {
    case 'uncommon': {
      if (!updated.onHitEffect && Math.random() < 0.6) {
        updated.onHitEffect = pickRandom(ON_HIT_EFFECT_POOL)
      }
      break
    }
    case 'rare': {
      if (!updated.onHitEffect) {
        updated.onHitEffect = pickRandom(ON_HIT_EFFECT_POOL)
      }
      if (!updated.passiveEffect && Math.random() < 0.5) {
        updated.passiveEffect = pickRandom(PASSIVE_EFFECT_POOL)
      }
      if (!updated.loreText) {
        updated.loreText = pickRandom(LORE_TEMPLATES)
      }
      break
    }
    case 'epic': {
      if (!updated.onHitEffect) {
        updated.onHitEffect = pickRandom(ON_HIT_EFFECT_POOL)
      }
      if (!updated.passiveEffect) {
        updated.passiveEffect = pickRandom(PASSIVE_EFFECT_POOL)
      }
      if (!updated.loreText) {
        updated.loreText = pickRandom(LORE_TEMPLATES)
      }
      if (!updated.drawback && Math.random() < 0.7) {
        updated.drawback = pickRandom(DRAWBACK_POOL)
      }
      break
    }
    case 'legendary': {
      if (!updated.onHitEffect) {
        updated.onHitEffect = pickRandom(ON_HIT_EFFECT_POOL)
      }
      if (!updated.passiveEffect) {
        updated.passiveEffect = pickRandom(PASSIVE_EFFECT_POOL)
      }
      if (!updated.loreText) {
        updated.loreText = pickRandom(LORE_TEMPLATES)
      }
      if (!updated.drawback) {
        updated.drawback = pickRandom(DRAWBACK_POOL)
      }
      break
    }
    default:
      break
  }

  return updated
}
