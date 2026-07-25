import { mulberry32 } from '../domain/simulation/prng'
import { DAILY_MODIFIER_POOL, MAP_LAYOUTS } from '../domain/constants'
import type { DailyModifier } from '../domain/constants'
import type { Difficulty } from '../store'

/**
 * Returns today's daily modifier for the given difficulty without running a
 * full simulation. Replicates the exact RNG call sequence from createSim so
 * the result always matches the in-game modifier.
 */
export function getDailyModifier(difficulty: Difficulty, date: Date = new Date()): DailyModifier {
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
  return DAILY_MODIFIER_POOL[modifierIndex]
}
