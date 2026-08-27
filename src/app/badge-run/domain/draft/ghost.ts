import { createPool, takeUnit, getAvailable } from './pool'
import type { CatalogUnit } from '../unit-catalog'
import { makePRNG } from '../rng'

const SHOP_SIZE = 5
const ROUNDS = 6

/**
 * A ghost is a recorded decision log — just the sequence of dexIds picked.
 * null entries represent rounds where the drafter passed or the pool was empty.
 */
export interface GhostLog {
  drafterId: string
  seed: number           // seed used during the original run
  picks: (number | null)[] // dexId per round, or null for pass
}

/**
 * A GhostDrafter replays a recorded decision log.
 * On each pick call, it returns the next pick from the log (ignoring the shop).
 */
export class GhostDrafter {
  private pickIdx = 0
  constructor(private readonly log: GhostLog) {}

  pick(_shop: unknown[], _board: CatalogUnit[], _seed: number): number | null {
    const pick = this.log.picks[this.pickIdx] ?? null
    this.pickIdx++
    return pick
  }
}

/**
 * Record a ghost log by running a single drafter through a lobby, capturing its picks.
 * The returned GhostLog can be replayed to reconstruct the same draft sequence.
 */
export function recordGhost(
  drafterId: string,
  seed: number,
  pickFn: (shop: ReturnType<typeof getAvailable>, board: CatalogUnit[], seed: number) => number | null,
): GhostLog {
  // Simulate a solo run (just this drafter, no rivals contesting the pool)
  const pool = createPool()
  const rng = makePRNG(seed)
  const board: CatalogUnit[] = []
  const picks: (number | null)[] = []

  for (let round = 0; round < ROUNDS; round++) {
    const available = getAvailable(pool)
    if (available.length === 0) { picks.push(null); continue }
    const poolCopy = [...available]
    const shop = []
    for (let i = 0; i < SHOP_SIZE && poolCopy.length > 0; i++) {
      const idx = rng.nextInt(poolCopy.length)
      shop.push(poolCopy[idx])
      poolCopy.splice(idx, 1)
    }
    const pickSeed = seed * 1000 + round
    const picked = pickFn(shop, board, pickSeed)
    picks.push(picked)
    if (picked !== null) {
      const unit = takeUnit(pool, picked)
      if (unit) board.push(unit)
    }
  }

  return { drafterId, seed, picks }
}

/**
 * Replay a ghost log against a given pool to reconstruct the rival's board.
 * Returns the units successfully taken (pool contention may cause some picks to fail).
 */
export function replayGhost(log: GhostLog, pool: ReturnType<typeof createPool>): CatalogUnit[] {
  const board: CatalogUnit[] = []
  for (const dexId of log.picks) {
    if (dexId === null) continue
    const unit = takeUnit(pool, dexId)
    if (unit) board.push(unit)
    // If unit is unavailable (contested), skip — contention is the point
  }
  return board
}
