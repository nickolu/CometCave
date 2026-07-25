import { mulberry32 } from '../domain/simulation/prng'
import { DAILY_MODIFIER_POOL, MAP_LAYOUTS, MAP_LAYOUT_NAMES } from '../domain/constants'
import type { DailyModifier } from '../domain/constants'
import type { Difficulty } from '../store'

/**
 * Returns today's map layout name and daily modifier for the given difficulty
 * without running a full simulation. Replicates the exact RNG call sequence
 * from createSim so the results always match the in-game values.
 */
export function getDailyInfo(
  difficulty: Difficulty,
  date: Date = new Date()
): { modifier: DailyModifier; layoutName: string } {
  const dateKey = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const diffHash = [...difficulty].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const seed = dateKey * 1000 + diffHash

  const rng = mulberry32(seed)
  // Call 1: layout index
  const layoutIndex = Math.floor(rng() * MAP_LAYOUTS.length)
  // Calls 2–7: jitter (2 per outpost, 3 outposts in every layout)
  const outpostCount = MAP_LAYOUTS[layoutIndex].length
  for (let i = 0; i < outpostCount; i++) {
    rng(); rng()
  }
  // Call 8: modifier
  const modifierIndex = Math.floor(rng() * DAILY_MODIFIER_POOL.length)

  return {
    modifier: DAILY_MODIFIER_POOL[modifierIndex],
    layoutName: MAP_LAYOUT_NAMES[layoutIndex],
  }
}

/** Convenience wrapper — returns only the modifier. */
export function getDailyModifier(difficulty: Difficulty, date?: Date): DailyModifier {
  return getDailyInfo(difficulty, date).modifier
}
