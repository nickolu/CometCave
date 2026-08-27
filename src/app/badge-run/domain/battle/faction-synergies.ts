import { getFaction } from '../data/factions'
import type { FactionName } from '../data/factions'
import type { BattleUnit } from './types'

interface StatBoost {
  attack?: number
  defense?: number
  specialAttack?: number
  specialDefense?: number
  speed?: number
  hp?: number
}

// For each faction: [at-2-boost, at-3-boost, at-4-boost]
// Legendary Birds only uses index 0 (capped at 2)
const FACTION_BREAKPOINTS: Record<FactionName, [StatBoost, StatBoost, StatBoost]> = {
  'Team Rocket':    [{ attack: 1.05 }, { attack: 1.10 }, { attack: 1.15 }],
  'Silph Co.':      [{ specialAttack: 1.10 }, { specialAttack: 1.20 }, { specialAttack: 1.30 }],
  'Elite Four':     [{ attack: 1.10, specialAttack: 1.10 }, { attack: 1.15, specialAttack: 1.15 }, { attack: 1.20, specialAttack: 1.20 }],
  'Fossils':        [{ defense: 1.15 }, { defense: 1.25, specialDefense: 1.10 }, { defense: 1.30, specialDefense: 1.20 }],
  'Eeveelutions':   [{ speed: 1.10, attack: 1.05 }, { speed: 1.15, attack: 1.10 }, { speed: 1.20, attack: 1.15, specialAttack: 1.10 }],
  'Safari Zone':    [{ hp: 1.10 }, { hp: 1.15, defense: 1.05 }, { hp: 1.20, defense: 1.10 }],
  'Legendary Birds':[{ speed: 1.20, specialAttack: 1.15 }, {}, {}], // capped at 2
}

const FACTION_THRESHOLDS = [2, 3, 4] // index 0 = 2 units, index 1 = 3 units, index 2 = 4 units
const LEGENDARY_BIRDS_MAX_THRESHOLD = 0 // only index 0 (the 2-unit boost) ever fires

function activeLevel(count: number, faction: FactionName): number {
  const maxIdx = faction === 'Legendary Birds' ? LEGENDARY_BIRDS_MAX_THRESHOLD : 2
  if (count >= 4 && maxIdx >= 2) return 2
  if (count >= 3 && maxIdx >= 1) return 1
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

export function applyFactionSynergies(units: BattleUnit[]): { synergyId: string; affectedUnitIds: string[]; effect: string }[] {
  // Group units by faction
  const factionUnits = new Map<FactionName, BattleUnit[]>()
  for (const unit of units) {
    const faction = getFaction(unit.dexId)
    if (!faction) continue
    const list = factionUnits.get(faction) ?? []
    list.push(unit)
    factionUnits.set(faction, list)
  }

  const applied: { synergyId: string; affectedUnitIds: string[]; effect: string }[] = []

  for (const [faction, factionGroup] of factionUnits) {
    const level = activeLevel(factionGroup.length, faction)
    if (level < 0) continue
    const threshold = FACTION_THRESHOLDS[level]
    const boost = FACTION_BREAKPOINTS[faction][level]
    if (Object.keys(boost).length === 0) continue // empty boost (shouldn't happen but safe)
    for (const unit of factionGroup) applyBoost(unit, boost)
    const effect = Object.entries(boost).map(([k, v]) => `+${Math.round((v - 1) * 100)}% ${k}`).join(', ')
    applied.push({
      synergyId: `faction:${faction}:${threshold}`,
      affectedUnitIds: factionGroup.map(u => u.instanceId),
      effect,
    })
  }
  return applied
}
