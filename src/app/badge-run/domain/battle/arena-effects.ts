import type { HouseRule } from '../data/arenas'
import type { MoveData } from './damage'
import type { BattleUnit } from './types'
import { effectiveness, type Type } from '../type-chart'

/**
 * Adjusts move power based on arena house rules.
 * Called before computeDamage.
 */
export function applyHouseRulePowerModifier(
  move: MoveData,
  houseRules: readonly HouseRule[]
): MoveData {
  let power = move.power

  for (const rule of houseRules) {
    if (rule === 'rain' && move.type === 'Fire') {
      power *= 0.8 // fire penalty in rain
    }
    if (rule === 'volcano' && move.type === 'Ice') {
      power *= 0.75 // ice penalty in volcano
    }
    if (rule === 'tech-surge' && move.category === 'special') {
      power *= 1.1 // SpAtk bonus
    }
  }

  return { ...move, power: Math.floor(power) }
}

/**
 * Returns the effectiveness multiplier, with excavation override:
 * Ground moves ignore Flying immunity in the excavation-site arena.
 */
export function getEffectiveness(
  moveType: Type,
  defenderTypes: string[],
  houseRules: readonly HouseRule[]
): number {
  const base = effectiveness(moveType, defenderTypes as Type[])
  // Excavation: Ground ignores Flying immunity
  if (
    base === 0 &&
    moveType === 'Ground' &&
    defenderTypes.includes('Flying') &&
    houseRules.includes('excavation')
  ) {
    // Ground vs pure Flying would normally be 0; override by removing Flying type
    const otherTypes = defenderTypes.filter(t => t !== 'Flying')
    return otherTypes.length > 0 ? effectiveness(moveType, otherTypes as Type[]) : 1
  }
  return base
}

/**
 * Apply blizzard: reduce effective speed by 10% for turn ordering.
 * Returns modified unit (does not mutate).
 */
export function applyBlizzardSpeed(unit: BattleUnit, houseRules: readonly HouseRule[]): BattleUnit {
  if (!houseRules.includes('blizzard')) return unit
  return { ...unit, speed: Math.floor(unit.speed * 0.9) }
}
