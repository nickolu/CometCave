import { makePRNG } from '../rng'
import { getArena } from '../data/arenas'
import { effectiveness } from '../type-chart'
import { buildTurnQueue } from './turn-queue'
import { computeDamage } from './damage'
import type { MoveData, MoveCategory } from './damage'
import type { BattleUnit, Team } from './types'
import type { BattleEvent, BattleResult } from './events'
import type { Type } from '../type-chart'

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

  return { name, type, category, power }
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
    const queue = buildTurnQueue(attacker.units, defender.units, rng)

    // --- Process each unit's action ---
    for (const entry of queue) {
      if (entry.unit.fainted) continue

      // Pick a random alive enemy
      const enemies =
        entry.teamId === 'attacker'
          ? aliveUnits(defender.units)
          : aliveUnits(attacker.units)

      if (enemies.length === 0) break

      const target = enemies[rng.nextInt(enemies.length)]
      const move = buildMove(entry.unit, arena)

      events.push({
        type: 'unit_acts',
        turn,
        actorId: entry.unit.instanceId,
        targetId: target.instanceId,
        moveName: move.name,
      })

      const dmg = computeDamage(entry.unit, target, move)
      const effectivenessValue = effectiveness(move.type, target.types as Type[])

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
