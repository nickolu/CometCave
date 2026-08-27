import type { BattleUnit } from './types'
import type { Kin } from '../unit-catalog'

interface StatBoost {
  attack?: number
  defense?: number
  specialAttack?: number
  specialDefense?: number
  speed?: number
  hp?: number
}

// [at-2-boost, at-4-boost, at-6-boost] — highest applicable level wins (not cumulative)
const KIN_BREAKPOINTS: Record<Kin, [StatBoost, StatBoost, StatBoost]> = {
  Pack:     [{ attack: 1.10 }, { attack: 1.20 }, { attack: 1.30, defense: 1.10 }],
  Flock:    [{ speed: 1.10 }, { speed: 1.20 }, { speed: 1.30 }],
  Brood:    [{ hp: 1.10 }, { hp: 1.20 }, { hp: 1.30 }],
  Shell:    [{ defense: 1.10 }, { defense: 1.15, specialDefense: 1.10 }, { defense: 1.20, specialDefense: 1.20 }],
  Mineral:  [{ defense: 1.15 }, { defense: 1.25 }, { defense: 1.30, specialDefense: 1.15 }],
  Serpent:  [{ attack: 1.10, specialAttack: 1.10 }, { attack: 1.20, specialAttack: 1.20 }, { attack: 1.30, specialAttack: 1.30 }],
  Humanoid: [{ attack: 1.10 }, { attack: 1.25 }, { attack: 1.40 }],
  Amorphous:[{ specialAttack: 1.10 }, { specialAttack: 1.20 }, { specialAttack: 1.30, specialDefense: 1.10 }],
}

function activeLevel(count: number): number {
  if (count >= 6) return 2
  if (count >= 4) return 1
  if (count >= 2) return 0
  return -1
}

function applyBoost(unit: BattleUnit, boost: StatBoost): void {
  if (boost.attack)        unit.attack        = Math.round(unit.attack        * boost.attack)
  if (boost.defense)       unit.defense       = Math.round(unit.defense       * boost.defense)
  if (boost.specialAttack) unit.specialAttack = Math.round(unit.specialAttack * boost.specialAttack)
  if (boost.specialDefense)unit.specialDefense= Math.round(unit.specialDefense* boost.specialDefense)
  if (boost.speed)         unit.speed         = Math.round(unit.speed         * boost.speed)
  if (boost.hp) {
    unit.maxHp     = Math.round(unit.maxHp     * boost.hp)
    unit.currentHp = Math.round(unit.currentHp * boost.hp)
  }
}

/**
 * Apply kin synergy bonuses to all units in the list (mutates in place).
 * Returns a list of { synergyId, affectedUnitIds, effect } for event emission.
 */
export function applyKinSynergies(units: BattleUnit[]): { synergyId: string; affectedUnitIds: string[]; effect: string }[] {
  const kinCounts = new Map<Kin, BattleUnit[]>()
  for (const unit of units) {
    const list = kinCounts.get(unit.kin as Kin) ?? []
    list.push(unit)
    kinCounts.set(unit.kin as Kin, list)
  }

  const applied: { synergyId: string; affectedUnitIds: string[]; effect: string }[] = []

  for (const [kin, kinUnits] of kinCounts) {
    const level = activeLevel(kinUnits.length)
    if (level < 0) continue
    const count = level === 2 ? 6 : level === 1 ? 4 : 2
    const boost = KIN_BREAKPOINTS[kin][level]
    for (const unit of kinUnits) applyBoost(unit, boost)
    const effect = Object.entries(boost).map(([k, v]) => `+${Math.round((v - 1) * 100)}% ${k}`).join(', ')
    applied.push({
      synergyId: `kin:${kin}:${count}`,
      affectedUnitIds: kinUnits.map(u => u.instanceId),
      effect,
    })
  }
  return applied
}
