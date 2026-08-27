import type { BattleUnit } from './types'
import type { PRNG } from '../rng'

export interface TurnEntry {
  unit: BattleUnit
  /** Which team this unit belongs to: 'attacker' | 'defender' */
  teamId: string
}

/**
 * Build the action order for one round.
 *
 * Units are sorted by speed descending. Ties are broken by a
 * deterministic RNG draw (higher draw goes first), so replaying
 * the same seed always produces the same order.
 *
 * Fainted units are excluded.
 */
export function buildTurnQueue(
  attackerUnits: BattleUnit[],
  defenderUnits: BattleUnit[],
  rng: PRNG
): TurnEntry[] {
  const entries: (TurnEntry & { tiebreaker: number })[] = [
    ...attackerUnits
      .filter(u => !u.fainted)
      .map(u => ({ unit: u, teamId: 'attacker', tiebreaker: rng.next() })),
    ...defenderUnits
      .filter(u => !u.fainted)
      .map(u => ({ unit: u, teamId: 'defender', tiebreaker: rng.next() })),
  ]

  entries.sort((a, b) => {
    if (b.unit.speed !== a.unit.speed) return b.unit.speed - a.unit.speed
    return b.tiebreaker - a.tiebreaker // higher draw wins tie
  })

  return entries.map(({ unit, teamId }) => ({ unit, teamId }))
}
