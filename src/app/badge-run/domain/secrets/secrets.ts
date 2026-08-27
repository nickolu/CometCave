/**
 * B-8.1 — Five authored secrets.
 * Undocumented in-game; discovered, screenshotted, shared.
 *
 * Secrets are named after Gen-1 locations that carry narrative weight.
 * Each has a hand-crafted trigger condition and a stat bonus.
 */

import { MAX_SURVIVAL_LEVEL } from '../levels/survival'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretId =
  | 'grunt-squad'
  | 'bug-catchers-net'
  | 'lavender-hour'
  | 'cinnabar-files'
  | 'old-friend'

/** Fossil Pokémon revived at Cinnabar Lab. */
export const FOSSIL_DEX_IDS: readonly number[] = [138, 139, 140, 141, 142]

/**
 * Minimal snapshot of run state needed to evaluate secrets.
 * Kept separate from BlitzRun to avoid a circular dependency.
 */
export interface SecretSnapshot {
  /** Current team composition. */
  team: ReadonlyArray<{ dexId: number; types: ReadonlyArray<string> }>
  /** Survival levels by dexId. */
  boardLevels: Readonly<Record<number, number>>
  /** Current round (1-29). */
  round: number
  /**
   * dexIds on the player's team at the END of round 1.
   * Populated after the first round-win; empty until then.
   */
  firstTeamDexIds: ReadonlyArray<number>
}

/**
 * A secret that is currently active.
 * Multiple secrets can be active at once; bonuses stack additively.
 */
export interface ActiveSecret {
  id: SecretId
  /** dexIds of units on the team that receive the bonus. */
  affectedDexIds: number[]
  /**
   * Flat multiplier added to all stats (e.g. 0.15 → +15%).
   * Applied to the post-survival-level stat value.
   */
  statMultiplier: number
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function hasType(unit: { types: ReadonlyArray<string> }, type: string): boolean {
  return unit.types.includes(type)
}

/**
 * Returns all secrets that are currently active for the given run state.
 * Called before building the battle team so bonuses are baked into BattleUnit stats.
 */
export function detectActiveSecrets(snap: SecretSnapshot): ActiveSecret[] {
  const { team, boardLevels, round, firstTeamDexIds } = snap
  const active: ActiveSecret[] = []

  if (team.length === 0) return active

  // ------------------------------------------------------------------
  // Grunt Squad
  // "A team of Rocket recruits — every slot a Poison type."
  // Trigger: all units on the team share the Poison type (team size ≥ 2).
  // Bonus: +15% all stats for every unit.
  // ------------------------------------------------------------------
  if (team.length >= 2 && team.every(u => hasType(u, 'Poison'))) {
    active.push({
      id: 'grunt-squad',
      affectedDexIds: team.map(u => u.dexId),
      statMultiplier: 0.15,
    })
  }

  // ------------------------------------------------------------------
  // Bug Catcher's Net
  // "You're still the kid who caught Caterpies."
  // Trigger: all units on the team share the Bug type (team size ≥ 2).
  // Bonus: +20% all stats for every unit.
  // ------------------------------------------------------------------
  if (team.length >= 2 && team.every(u => hasType(u, 'Bug'))) {
    active.push({
      id: 'bug-catchers-net',
      affectedDexIds: team.map(u => u.dexId),
      statMultiplier: 0.20,
    })
  }

  // ------------------------------------------------------------------
  // Lavender Hour
  // "It haunts the tower. It survived every round. Now it remembers."
  // Trigger: a Ghost-type unit on the team has reached the max survival level (25).
  // Bonus: +50% all stats for that Ghost unit only.
  // ------------------------------------------------------------------
  const ghostsAtMax = team.filter(
    u => hasType(u, 'Ghost') && (boardLevels[u.dexId] ?? 0) >= MAX_SURVIVAL_LEVEL,
  )
  if (ghostsAtMax.length > 0) {
    active.push({
      id: 'lavender-hour',
      affectedDexIds: ghostsAtMax.map(u => u.dexId),
      statMultiplier: 0.50,
    })
  }

  // ------------------------------------------------------------------
  // Cinnabar Files
  // "Lab notes never published. A fossil that outlasted its age."
  // Trigger: a fossil Pokémon is on the team AND round ≥ 25 (Elite Four / Champion).
  // Bonus: +40% all stats for the fossil unit(s) only.
  // ------------------------------------------------------------------
  if (round >= 25) {
    const fossilsOnTeam = team.filter(u => FOSSIL_DEX_IDS.includes(u.dexId))
    if (fossilsOnTeam.length > 0) {
      active.push({
        id: 'cinnabar-files',
        affectedDexIds: fossilsOnTeam.map(u => u.dexId),
        statMultiplier: 0.40,
      })
    }
  }

  // ------------------------------------------------------------------
  // Old Friend
  // "You picked it first. You never let go. It remembers that."
  // Trigger: a unit from the round-1 team is still on the team AND round ≥ 25.
  // Bonus: +75% all stats for that veteran unit.
  // ------------------------------------------------------------------
  if (round >= 25 && firstTeamDexIds.length > 0) {
    const veterans = team.filter(u => firstTeamDexIds.includes(u.dexId))
    if (veterans.length > 0) {
      active.push({
        id: 'old-friend',
        affectedDexIds: veterans.map(u => u.dexId),
        statMultiplier: 0.75,
      })
    }
  }

  return active
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/**
 * Returns the total secret stat multiplier for a unit.
 * Secrets stack additively (a unit can benefit from multiple secrets).
 */
export function getUnitSecretMultiplier(dexId: number, activeSecrets: ActiveSecret[]): number {
  return activeSecrets
    .filter(s => s.affectedDexIds.includes(dexId))
    .reduce((sum, s) => sum + s.statMultiplier, 0)
}

/**
 * Apply a flat stat multiplier from secrets to a set of base stats.
 * Uses Math.round to avoid IEEE 754 artifacts.
 */
export function applySecretBonus(
  stats: { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number },
  multiplier: number,
): typeof stats {
  if (multiplier === 0) return stats
  const factor = 1 + multiplier
  return {
    hp: Math.round(stats.hp * factor),
    attack: Math.round(stats.attack * factor),
    defense: Math.round(stats.defense * factor),
    specialAttack: Math.round(stats.specialAttack * factor),
    specialDefense: Math.round(stats.specialDefense * factor),
    speed: Math.round(stats.speed * factor),
  }
}
