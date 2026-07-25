import { mulberry32 } from '../domain/simulation/prng'
import { DAILY_MODIFIER_POOL } from '../domain/constants'
import type { DailyModifier } from '../domain/constants'
import type { Difficulty } from '../store'

/**
 * Returns today's daily modifier for the given difficulty without running a
 * full simulation. Replicates the exact RNG call sequence from createSim
 * (with default outpostCount=3) so the result always matches the in-game value.
 */
export function getDailyInfo(
  difficulty: Difficulty,
  date: Date = new Date(),
  outpostCount = 3,
): { modifier: DailyModifier; layoutName: string } {
  const dateKey = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const diffHash = [...difficulty].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const seed = dateKey * 1000 + diffHash

  const rng = mulberry32(seed)

  // Replicate generateOutpostPositions(outpostCount, rng) RNG consumption:
  // - Fisher-Yates shuffle over the cell grid
  // - Jitter calls (2 per outpost)
  const cols = Math.ceil(Math.sqrt(outpostCount * 1.5))
  const rows = Math.ceil(outpostCount / cols)
  const totalCells = cols * rows
  // Fisher-Yates: i from totalCells-1 down to 1
  for (let i = totalCells - 1; i > 0; i--) {
    rng()
  }
  // Jitter: 2 calls per outpost
  for (let i = 0; i < outpostCount; i++) {
    rng(); rng()
  }

  // Final call: modifier
  const modifierIndex = Math.floor(rng() * DAILY_MODIFIER_POOL.length)

  return {
    modifier: DAILY_MODIFIER_POOL[modifierIndex],
    layoutName: 'Generated',  // dynamic layouts don't have fixed names
  }
}

/** Convenience wrapper — returns only the modifier. */
export function getDailyModifier(difficulty: Difficulty, date?: Date): DailyModifier {
  return getDailyInfo(difficulty, date).modifier
}
