/** Base gold income per round */
export const BASE_INCOME = 5

/**
 * Interest: +1 per 10 gold saved, capped at 5.
 * e.g. 0-9 saved → 0, 10-19 → 1, 50+ → 5
 */
export function computeInterest(savedGold: number): number {
  return Math.min(5, Math.floor(savedGold / 10))
}

/**
 * Streak bonus: +1/+2/+3 for 1/2/3+ consecutive wins or losses.
 * Both win streaks and loss streaks give the same bonus amount
 * (loss streak bonus is a "consolation" income boost).
 */
export function computeStreakBonus(streak: number): number {
  return Math.min(3, streak)
}

/**
 * Total gold income for a round.
 * @param savedGold  Gold the player ended last round with (for interest)
 * @param streak     Length of current win or loss streak (0 if none)
 */
export function computeRoundIncome(savedGold: number, streak: number): number {
  return BASE_INCOME + computeInterest(savedGold) + computeStreakBonus(streak)
}
