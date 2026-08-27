import { effectiveness, type Type } from '../type-chart'
import type { BattleUnit } from './types'

export type MoveCategory = 'physical' | 'special'

export interface MoveData {
  name: string
  type: Type
  category: MoveCategory
  power: number
}

/**
 * Compute damage dealt.
 *
 * Formula: floor(power × (atk / def) × effectiveness × stab)
 * - Physical moves: attacker.attack vs defender.defense
 * - Special moves: attacker.specialAttack vs defender.specialDefense
 * - STAB: 1.5 if attacker's primary type matches move type, else 1
 * - effectiveness: from the type chart (dual-type defenders multiply)
 *
 * Minimum damage is 1 (unless effectiveness is 0).
 */
export function computeDamage(
  attacker: BattleUnit,
  defender: BattleUnit,
  move: MoveData
): number {
  const atk = move.category === 'physical' ? attacker.attack : attacker.specialAttack
  const def = move.category === 'physical' ? defender.defense : defender.specialDefense

  const stab = attacker.types.includes(move.type) ? 1.5 : 1
  const eff = effectiveness(move.type, defender.types as Type[])

  const raw = move.power * (atk / def) * eff * stab
  if (eff === 0) return 0
  return Math.max(1, Math.floor(raw))
}
