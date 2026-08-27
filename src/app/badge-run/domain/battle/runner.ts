import { makePRNG } from '../rng'
import { getArena } from '../data/arenas'
import { buildTurnQueue } from './turn-queue'
import { computeDamage } from './damage'
import type { MoveData, MoveCategory } from './damage'
import type { BattleUnit, Team } from './types'
import type { BattleEvent, BattleResult } from './events'
import type { Type } from '../type-chart'
import { applyHouseRulePowerModifier, getEffectiveness, applyBlizzardSpeed } from './arena-effects'
import { getTargets } from './positioning'
import { applyKinSynergies } from './kin-synergies'
import { applyFactionSynergies } from './faction-synergies'

const MAX_ROUNDS = 100

/** Power by tier */
const TIER_POWER: Record<string, number> = {
  T1: 40,
  T2: 50,
  T3: 60,
  T4: 75,
  T5: 90,
}

function deepCopyTeam(team: Team): Team {
  return {
    id: team.id,
    units: team.units.map(u => ({ ...u })),
  }
}

function aliveUnits(units: BattleUnit[]): BattleUnit[] {
  return units.filter(u => !u.fainted)
}

function totalHp(units: BattleUnit[]): number {
  return units.reduce((sum, u) => sum + u.currentHp, 0)
}

function buildMove(unit: BattleUnit, arena: ReturnType<typeof getArena>): MoveData {
  const type = unit.types[0] as Type
  const category: MoveCategory = unit.attack >= unit.specialAttack ? 'physical' : 'special'
  const basePower = TIER_POWER[unit.tier] ?? 50
  const name = unit.signatureMove ?? `${unit.types[0]} Strike`

  // Apply arena type boost if move type matches
  let power = basePower
  if (arena) {
    const boost = arena.typeBoosts[type as keyof typeof arena.typeBoosts]
    if (boost !== undefined) {
      power = basePower * boost
    }
  }

  const move: MoveData = { name, type, category, power }

  // Apply house rule power modifiers (e.g. rain penalizes Fire, volcano penalizes Ice)
  if (arena && arena.houseRules.length > 0) {
    return applyHouseRulePowerModifier(move, arena.houseRules)
  }

  return move
}

export function runBattle(
  attackerTeam: Team,
  defenderTeam: Team,
  arenaId: string,
  seed: number,
): { events: BattleEvent[]; result: BattleResult } {
  const attacker = deepCopyTeam(attackerTeam)
  const defender = deepCopyTeam(defenderTeam)
  const arena = getArena(arenaId)
  const rng = makePRNG(seed)
  const events: BattleEvent[] = []

  // --- Resolve synergies (pre-battle, turn 0) ---
  const synergyEvents: BattleEvent[] = []
  for (const [team] of [[attacker], [defender]] as const) {
    const kinResults = applyKinSynergies(team.units)
    const factionResults = applyFactionSynergies(team.units)
    for (const s of [...kinResults, ...factionResults]) {
      synergyEvents.push({
        type: 'synergy_applied',
        turn: 0,
        synergyId: s.synergyId,
        affectedUnitIds: s.affectedUnitIds,
        effect: s.effect,
      })
    }
  }
  // Prepend synergy events (they happen before turn 1)
  events.push(...synergyEvents)

  let turn = 0
  let winnerId: string | null = null

  function checkWin(): boolean {
    const attackerAlive = aliveUnits(attacker.units).length > 0
    const defenderAlive = aliveUnits(defender.units).length > 0

    if (!attackerAlive && !defenderAlive) {
      // Both wiped out simultaneously — attacker wins by convention
      winnerId = attacker.id
      return true
    }
    if (!attackerAlive) {
      winnerId = defender.id
      return true
    }
    if (!defenderAlive) {
      winnerId = attacker.id
      return true
    }
    return false
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    turn = round + 1

    // --- Arena tick ---
    const arenaAffected: string[] = []
    if (arena && arena.houseRules.includes('toxic-spill')) {
      const allUnits = [...attacker.units, ...defender.units].filter(u => !u.fainted)
      for (const unit of allUnits) {
        const poisonDmg = Math.max(1, Math.floor(unit.maxHp * 0.05))
        unit.currentHp = Math.max(0, unit.currentHp - poisonDmg)
        arenaAffected.push(unit.instanceId)
        if (unit.currentHp === 0 && !unit.fainted) {
          unit.fainted = true
          events.push({ type: 'faint', turn, unitId: unit.instanceId })
        }
      }
    }

    events.push({
      type: 'arena_tick',
      turn,
      arenaId,
      rule: arena ? (arena.houseRules[0] ?? 'none') : 'none',
      affectedUnitIds: arenaAffected,
    })

    // Check win after arena tick
    if (checkWin()) break

    // --- Build turn queue ---
    // Apply blizzard speed reduction for turn ordering (does not mutate units permanently)
    const houseRules = arena ? arena.houseRules : []
    const attackerUnitsForQueue = attacker.units.map(u => applyBlizzardSpeed(u, houseRules))
    const defenderUnitsForQueue = defender.units.map(u => applyBlizzardSpeed(u, houseRules))
    const rawQueue = buildTurnQueue(attackerUnitsForQueue, defenderUnitsForQueue, rng)

    // Remap queue entries to live unit references (so fainted/HP changes are visible)
    const unitById = new Map<string, BattleUnit>()
    for (const u of attacker.units) unitById.set(u.instanceId, u)
    for (const u of defender.units) unitById.set(u.instanceId, u)
    const queue = rawQueue.map(entry => ({
      unit: unitById.get(entry.unit.instanceId) ?? entry.unit,
      teamId: entry.teamId,
    }))

    // --- Process each unit's action ---
    for (const entry of queue) {
      if (entry.unit.fainted) continue

      // Pick a random alive enemy
      const enemyUnits =
        entry.teamId === 'attacker'
          ? defender.units
          : attacker.units

      const move = buildMove(entry.unit, arena)
      const enemies = getTargets(enemyUnits, move, houseRules)

      if (enemies.length === 0) break

      const target = enemies[rng.nextInt(enemies.length)]

      events.push({
        type: 'unit_acts',
        turn,
        actorId: entry.unit.instanceId,
        targetId: target.instanceId,
        moveName: move.name,
      })

      const effectivenessValue = getEffectiveness(move.type, target.types, houseRules)
      // computeDamage uses effectiveness internally; if houseRules override it (e.g. excavation),
      // compute damage manually with the overridden value instead.
      let dmg: number
      if (houseRules.includes('excavation') && move.type === 'Ground' && target.types.includes('Flying')) {
        // Override: compute damage with overridden effectiveness
        const atk = move.category === 'physical' ? entry.unit.attack : entry.unit.specialAttack
        const def = move.category === 'physical' ? target.defense : target.specialDefense
        const stab = entry.unit.types.includes(move.type) ? 1.5 : 1
        const raw = move.power * (atk / def) * effectivenessValue * stab
        dmg = effectivenessValue === 0 ? 0 : Math.max(1, Math.floor(raw))
      } else {
        dmg = computeDamage(entry.unit, target, move)
      }

      target.currentHp = Math.max(0, target.currentHp - dmg)

      events.push({
        type: 'damage',
        turn,
        targetId: target.instanceId,
        amount: dmg,
        effectiveness: effectivenessValue,
        critical: false,
      })

      if (target.currentHp === 0 && !target.fainted) {
        target.fainted = true
        events.push({ type: 'faint', turn, unitId: target.instanceId })
      }

      if (checkWin()) break
    }

    if (winnerId !== null) break
  }

  // --- Cycle cap: determine winner by remaining HP ---
  if (winnerId === null) {
    const attackerHp = totalHp(attacker.units)
    const defenderHp = totalHp(defender.units)
    winnerId = attackerHp >= defenderHp ? attacker.id : defender.id
  }

  const loserId = winnerId === attacker.id ? defender.id : attacker.id

  events.push({
    type: 'battle_end',
    turn,
    winnerId,
    loserId,
  })

  const result: BattleResult = {
    config: {
      seed,
      arenaId,
      attackerTeamId: attacker.id,
      defenderTeamId: defender.id,
    },
    events,
    winnerId,
    totalTurns: turn,
  }

  return { events, result }
}
