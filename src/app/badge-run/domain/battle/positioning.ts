import type { BattleUnit } from './types'
import type { MoveData } from './damage'

export function getTargets(enemyUnits: BattleUnit[], move: MoveData, houseRules: string[]): BattleUnit[] {
  const excavation = houseRules.includes('excavation')
  if (move.category === 'physical' && !excavation) {
    const aliveFront = enemyUnits.slice(0, 3).filter(u => !u.fainted)
    if (aliveFront.length > 0) return aliveFront
    return enemyUnits.slice(3).filter(u => !u.fainted)
  }
  return enemyUnits.filter(u => !u.fainted)
}
