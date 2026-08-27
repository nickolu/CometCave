/**
 * Player health point system for the 29-round Badge Run gauntlet.
 * Each player starts with MAX_PLAYER_HP. Losses deal damage; reaching 0 eliminates the player.
 */

export const MAX_PLAYER_HP = 100

/**
 * Compute the HP damage dealt to the player on a loss.
 *
 * Formula: (5 + round) + survivingEnemyCount
 * Gym rounds (boss battles) deal double damage.
 *
 * @param round              Current round number (1-29)
 * @param survivingEnemyCount Number of enemy units still alive at battle end
 * @param isGymRound         Whether this is a gym/boss round (deals 2× damage)
 */
export function computeLossDamage(
  round: number,
  survivingEnemyCount: number,
  isGymRound: boolean,
): number {
  const raw = (5 + round) + survivingEnemyCount
  return isGymRound ? raw * 2 : raw
}

/**
 * Apply HP damage to current player HP, clamped to [0, MAX_PLAYER_HP].
 */
export function applyDamage(currentHp: number, damage: number): number {
  return Math.max(0, currentHp - damage)
}
