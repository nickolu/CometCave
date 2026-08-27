import type { ItemId } from './items'

/** Each entry is [ingredientA, ingredientB, result]. */
const COMBO_RECIPES: [ItemId, ItemId, ItemId][] = [
  ['eviolite',     'everstone',     'thick-club'],
  ['eviolite',     'choice-band',   'thick-club'],
  ['eviolite',     'choice-specs',  'deep-sea-tooth'],
  ['choice-band',  'choice-scarf',  'power-belt'],
  ['choice-specs', 'choice-scarf',  'power-lens'],
  ['choice-band',  'life-orb',      'expert-belt'],
  ['choice-band',  'choice-specs',  'muscle-band'],
  ['choice-specs', 'leftovers',     'wise-glasses'],
  ['rocky-helmet', 'leftovers',     'iron-barbs'],
  ['leftovers',    'leftovers',     'big-root'],
  ['life-orb',     'choice-scarf',  'quick-claw'],
  ['rocky-helmet', 'choice-band',   'binding-band'],
]

/** Normalize a pair of items to a canonical (sorted) key. */
function comboKey(a: ItemId, b: ItemId): string {
  return [a, b].sort().join('|')
}

const COMBO_MAP: Map<string, ItemId> = new Map(
  COMBO_RECIPES.map(([a, b, result]) => [comboKey(a, b), result])
)

/**
 * Look up the combination result for two items.
 * Commutative: getCombo(A, B) === getCombo(B, A).
 * Returns null if no combination exists.
 */
export function getCombo(a: ItemId, b: ItemId): ItemId | null {
  return COMBO_MAP.get(comboKey(a, b)) ?? null
}

/** Return all combination recipes as [itemA, itemB, result] triples. */
export function allCombos(): Array<[ItemId, ItemId, ItemId]> {
  return COMBO_RECIPES.map(([a, b, result]) => [a, b, result])
}
