import { UNIT_CATALOG } from '../unit-catalog'

export type ItemId =
  // 8 basic items
  | 'eviolite'
  | 'everstone'
  | 'choice-scarf'
  | 'choice-band'
  | 'choice-specs'
  | 'rocky-helmet'
  | 'life-orb'
  | 'leftovers'
  // 12 combination items
  | 'assault-vest'
  | 'power-belt'
  | 'power-lens'
  | 'expert-belt'
  | 'muscle-band'
  | 'wise-glasses'
  | 'iron-barbs'
  | 'big-root'
  | 'thick-club'
  | 'deep-sea-tooth'
  | 'quick-claw'
  | 'binding-band'

export type StatKey = 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed'

export interface ItemEffect {
  /** Display name */
  name: string
  /** Multiplicative stat boosts. Applied to the stat value. e.g. { speed: 1.5 } → speed×1.5 */
  statMultipliers?: Partial<Record<StatKey, number>>
  /** If 'unevolved', stat multipliers only apply when the unit has an evolution (evolvesTo !== null). */
  statCondition?: 'unevolved'
  /** Everstone: prevents copy-based evolution trigger. */
  blocksEvolution?: boolean
  /** Life Orb style: boost damage dealt by this factor. */
  damageBoost?: number
  /** Life Orb style: holder takes this fraction of their max HP after each attack. */
  recoilFraction?: number
  /** Rocky Helmet: attacker takes this fraction of their own max HP on contact. */
  contactRetaliationFraction?: number
  /** Leftovers: heal this fraction of max HP at the start of each turn. */
  healFraction?: number
}

export const ITEMS: Record<ItemId, ItemEffect> = {
  // --- 8 basic items ---
  'eviolite': {
    name: 'Eviolite',
    statMultipliers: { defense: 1.5, specialDefense: 1.5 },
    statCondition: 'unevolved',
  },
  'everstone': {
    name: 'Everstone',
    blocksEvolution: true,
  },
  'choice-scarf': {
    name: 'Choice Scarf',
    statMultipliers: { speed: 1.5 },
  },
  'choice-band': {
    name: 'Choice Band',
    statMultipliers: { attack: 1.5 },
  },
  'choice-specs': {
    name: 'Choice Specs',
    statMultipliers: { specialAttack: 1.5 },
  },
  'rocky-helmet': {
    name: 'Rocky Helmet',
    contactRetaliationFraction: 1 / 6,
  },
  'life-orb': {
    name: 'Life Orb',
    damageBoost: 1.3,
    recoilFraction: 0.1,
  },
  'leftovers': {
    name: 'Leftovers',
    healFraction: 0.0625,
  },

  // --- 12 combination items ---
  'assault-vest': {
    name: 'Assault Vest',
    statMultipliers: { specialDefense: 1.5, defense: 1.25 },
  },
  'power-belt': {
    name: 'Power Belt',
    statMultipliers: { attack: 1.3, speed: 1.3 },
  },
  'power-lens': {
    name: 'Power Lens',
    statMultipliers: { specialAttack: 1.3, speed: 1.3 },
  },
  'expert-belt': {
    name: 'Expert Belt',
    statMultipliers: { attack: 1.6 },
  },
  'muscle-band': {
    name: 'Muscle Band',
    statMultipliers: { attack: 1.25, specialDefense: 1.25 },
  },
  'wise-glasses': {
    name: 'Wise Glasses',
    statMultipliers: { specialAttack: 1.25, specialDefense: 1.25 },
  },
  'iron-barbs': {
    name: 'Iron Barbs',
    contactRetaliationFraction: 1 / 4,
    healFraction: 0.0625,
  },
  'big-root': {
    name: 'Big Root',
    healFraction: 0.125,
  },
  'thick-club': {
    name: 'Thick Club',
    statMultipliers: { attack: 1.5, defense: 1.5, specialDefense: 1.5 },
    statCondition: 'unevolved',
  },
  'deep-sea-tooth': {
    name: 'Deep Sea Tooth',
    statMultipliers: { specialAttack: 1.5, defense: 1.5, specialDefense: 1.5 },
    statCondition: 'unevolved',
  },
  'quick-claw': {
    name: 'Quick Claw',
    statMultipliers: { speed: 1.25, attack: 1.25 },
  },
  'binding-band': {
    name: 'Binding Band',
    damageBoost: 1.15,
    statMultipliers: { attack: 1.15, specialAttack: 1.15 },
  },
}

/**
 * Returns true if a unit with the given dexId is considered "unevolved"
 * (i.e., it has a valid evolvesTo in the catalog).
 */
export function isUnevolved(dexId: number): boolean {
  const unit = UNIT_CATALOG.find(u => u.dexId === dexId)
  return unit !== undefined && unit.evolvesTo !== null && unit.evolvesTo !== undefined
}

/**
 * Apply stat multipliers from an item to a set of raw stats.
 * Respects statCondition: only applies when the condition is met.
 * Uses Math.round to avoid floating point artifacts.
 */
export function applyItemStats(
  stats: Record<StatKey, number>,
  itemId: ItemId,
  dexId: number,
): Record<StatKey, number> {
  const effect = ITEMS[itemId]
  if (!effect.statMultipliers) return stats

  // Check condition
  if (effect.statCondition === 'unevolved' && !isUnevolved(dexId)) {
    return stats
  }

  const result = { ...stats }
  for (const [key, mult] of Object.entries(effect.statMultipliers) as [StatKey, number][]) {
    result[key] = Math.round(result[key] * mult)
  }
  return result
}
