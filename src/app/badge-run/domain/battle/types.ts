/** A unit as it appears in a battle (snapshot of catalog data + live HP) */
export interface BattleUnit {
  /** Unique per-battle instance id (e.g. "attacker-0", "defender-2") */
  instanceId: string
  dexId: number
  name: string
  types: string[]
  tier: string
  kin: string
  maxHp: number
  currentHp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
  signatureMove: string | null
  fainted: boolean
}

export interface Team {
  id: string
  units: BattleUnit[]
}

export interface BattleConfig {
  seed: number
  arenaId: string
  /** The player's team */
  attacker: Team
  /** The opponent's team */
  defender: Team
}
