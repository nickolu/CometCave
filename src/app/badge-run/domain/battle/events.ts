/** A unit takes its turn and uses its move */
export interface UnitActsEvent {
  type: 'unit_acts'
  turn: number
  actorId: string   // instanceId of the acting unit
  targetId: string  // instanceId of the target unit
  moveName: string
}

/** A unit takes damage */
export interface DamageEvent {
  type: 'damage'
  turn: number
  targetId: string
  amount: number        // HP lost (always positive)
  effectiveness: number // 0, 0.5, 1, 2, 4, etc.
  critical: boolean
}

/** A unit faints (HP reaches 0) */
export interface FaintEvent {
  type: 'faint'
  turn: number
  unitId: string
}

/** The arena's house rule effect fires (once per round) */
export interface ArenaTickEvent {
  type: 'arena_tick'
  turn: number
  arenaId: string
  rule: string         // the HouseRule string
  affectedUnitIds: string[]
}

/** A synergy bonus activates */
export interface SynergyAppliedEvent {
  type: 'synergy_applied'
  turn: number
  synergyId: string    // e.g. "kin:Brood:2" or "faction:Team Rocket:3"
  affectedUnitIds: string[]
  effect: string       // human-readable description, e.g. "+15% attack"
}

/** The battle ends */
export interface BattleEndEvent {
  type: 'battle_end'
  turn: number
  winnerId: string     // team id of the winner
  loserId: string
}

export type BattleEvent =
  | UnitActsEvent
  | DamageEvent
  | FaintEvent
  | ArenaTickEvent
  | SynergyAppliedEvent
  | BattleEndEvent

/** The full result of a simulated battle */
export interface BattleResult {
  config: {
    seed: number
    arenaId: string
    attackerTeamId: string
    defenderTeamId: string
  }
  events: BattleEvent[]
  winnerId: string
  totalTurns: number
}
