import { SpellElement } from '@/app/tap-tap-adventure/models/spell'

/**
 * Elemental weakness/resistance chart.
 *
 * Each element maps to the set of elements it is strong against (2x damage)
 * and the set of elements that resist it (0.5x damage).
 *
 * - Fire beats Nature, weak to Ice
 * - Ice beats Fire, weak to Lightning
 * - Lightning beats Ice, weak to Nature
 * - Shadow beats Arcane, weak to Nature
 * - Nature beats Lightning/Shadow, weak to Fire
 * - Arcane beats Shadow, weak to none (neutral)
 * - None is always neutral
 */

const WEAKNESSES: Partial<Record<SpellElement, SpellElement[]>> = {
  fire: ['nature'],
  ice: ['fire'],
  lightning: ['ice'],
  shadow: ['arcane'],
  nature: ['lightning', 'shadow'],
  arcane: ['shadow'],
}

const RESISTANCES: Partial<Record<SpellElement, SpellElement[]>> = {
  fire: ['ice'],
  ice: ['lightning'],
  lightning: ['nature'],
  shadow: ['nature'],
  nature: ['fire'],
}

/**
 * Returns the elemental multiplier when `attackElement` strikes a target
 * whose element is `defenseElement`.
 *
 * - 2.0 if the defender is weak to the attacker's element
 * - 0.5 if the defender resists the attacker's element
 * - 1.0 otherwise (neutral)
 */
export function getElementalMultiplier(
  attackElement: SpellElement | undefined,
  defenseElement: SpellElement | undefined
): number {
  if (!attackElement || !defenseElement) return 1.0
  if (attackElement === 'none' || defenseElement === 'none') return 1.0

  const weakTo = WEAKNESSES[attackElement]
  if (weakTo && weakTo.includes(defenseElement)) {
    return 2.0
  }

  const resistedBy = RESISTANCES[attackElement]
  if (resistedBy && resistedBy.includes(defenseElement)) {
    return 0.5
  }

  return 1.0
}

/**
 * Returns a human-readable description of the elemental effectiveness.
 */
export function getEffectivenessText(multiplier: number): string | null {
  if (multiplier >= 2.0) return 'Super effective!'
  if (multiplier <= 0.5) return 'Resisted!'
  return null
}

/**
 * Color mapping for element badges in the UI.
 */
export const ELEMENT_COLORS: Record<SpellElement, string> = {
  fire: 'bg-red-900/50 text-red-400',
  ice: 'bg-sky-900/50 text-sky-400',
  lightning: 'bg-yellow-900/50 text-yellow-400',
  shadow: 'bg-purple-900/50 text-purple-400',
  nature: 'bg-green-900/50 text-green-400',
  arcane: 'bg-indigo-900/50 text-indigo-400',
  none: 'bg-slate-700/50 text-slate-400',
}
