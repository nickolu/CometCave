import { Spell } from '@/app/tap-tap-adventure/models/spell'

export interface SpellComboResult {
  comboName: string
  damageMultiplier: number      // bonus damage = totalDmg * (multiplier - 1)
  ignoreDefense: boolean
  bonusHealPct: number          // fraction of maxHp to heal (0 = none)
  chainHit: boolean             // deal second hit at 50% base damage
  removeEnemyDefenseBuff: boolean // Frostfire: halve enemy.defense
  slowEnemy: boolean            // Void Freeze: apply slow status
}

interface SpellComboEntry {
  sequence: string[]
  result: SpellComboResult
}

export const SPELL_COMBOS: SpellComboEntry[] = [
  // 3-element combos first (checked before 2-element to avoid partial matches)
  {
    sequence: ['arcane', 'arcane', 'arcane'],
    result: {
      comboName: 'Arcane Cascade',
      damageMultiplier: 3.0,
      ignoreDefense: false,
      bonusHealPct: 0,
      chainHit: false,
      removeEnemyDefenseBuff: false,
      slowEnemy: false,
    },
  },
  {
    sequence: ['fire', 'ice', 'lightning'],
    result: {
      comboName: 'Elemental Fury',
      damageMultiplier: 2.0,
      ignoreDefense: false,
      bonusHealPct: 0,
      chainHit: false,
      removeEnemyDefenseBuff: false,
      slowEnemy: false,
    },
  },
  // 2-element combos
  {
    sequence: ['fire', 'lightning'],
    result: {
      comboName: 'Plasma Burst',
      damageMultiplier: 1.5,
      ignoreDefense: false,
      bonusHealPct: 0,
      chainHit: false,
      removeEnemyDefenseBuff: false,
      slowEnemy: false,
    },
  },
  {
    sequence: ['ice', 'fire'],
    result: {
      comboName: 'Frostfire',
      damageMultiplier: 1.3,
      ignoreDefense: false,
      bonusHealPct: 0,
      chainHit: false,
      removeEnemyDefenseBuff: true,
      slowEnemy: false,
    },
  },
  {
    sequence: ['shadow', 'lightning'],
    result: {
      comboName: 'Shadow Storm',
      damageMultiplier: 1.75,
      ignoreDefense: true,
      bonusHealPct: 0,
      chainHit: false,
      removeEnemyDefenseBuff: false,
      slowEnemy: false,
    },
  },
  {
    sequence: ['nature', 'nature'],
    result: {
      comboName: "Nature's Wrath",
      damageMultiplier: 1.0,
      ignoreDefense: false,
      bonusHealPct: 0.15,
      chainHit: false,
      removeEnemyDefenseBuff: false,
      slowEnemy: false,
    },
  },
  {
    sequence: ['shadow', 'ice'],
    result: {
      comboName: 'Void Freeze',
      damageMultiplier: 1.4,
      ignoreDefense: false,
      bonusHealPct: 0,
      chainHit: false,
      removeEnemyDefenseBuff: false,
      slowEnemy: true,
    },
  },
  {
    sequence: ['nature', 'lightning'],
    result: {
      comboName: 'Wild Lightning',
      damageMultiplier: 1.6,
      ignoreDefense: false,
      bonusHealPct: 0,
      chainHit: true,
      removeEnemyDefenseBuff: false,
      slowEnemy: false,
    },
  },
]

/**
 * Check whether the last N elements in the history match a known combo.
 * Longer sequences are checked first to avoid partial matches (e.g., Plasma Burst
 * should not fire mid-way through Elemental Fury).
 *
 * Returns the matched combo result, or null if no match.
 * Never fires when the last element is 'none'.
 */
export function checkSpellCombo(lastElements: string[]): SpellComboResult | null {
  if (lastElements.length === 0) return null

  const lastElement = lastElements[lastElements.length - 1]
  if (lastElement === 'none') return null

  for (const combo of SPELL_COMBOS) {
    const { sequence, result } = combo
    if (lastElements.length < sequence.length) continue

    const tail = lastElements.slice(-sequence.length)
    const matches = tail.every((el, i) => el === sequence[i])
    if (matches) return result
  }

  return null
}

/**
 * Extract the primary element from a spell's effects.
 * Returns the first non-'none' element found in damage/true_damage/lifesteal effects,
 * then any other effect with an element, then the spell's school if it maps to an element,
 * otherwise 'none'.
 */
export function getSpellElement(spell: Spell): string {
  const damagingTypes = new Set(['damage', 'true_damage', 'lifesteal'])

  // Prefer elemental damage effects
  for (const effect of spell.effects ?? []) {
    if (damagingTypes.has(effect.type) && effect.element && effect.element !== 'none') {
      return effect.element
    }
  }

  // Fall back to any effect with an element
  for (const effect of spell.effects ?? []) {
    if (effect.element && effect.element !== 'none') {
      return effect.element
    }
  }

  // Map school to element as a last resort
  const schoolElementMap: Record<string, string> = {
    arcane: 'arcane',
    nature: 'nature',
    shadow: 'shadow',
    // 'war' has no elemental equivalent
  }
  const schoolElement = schoolElementMap[spell.school]
  if (schoolElement) return schoolElement

  return 'none'
}
