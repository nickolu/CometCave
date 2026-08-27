import { createPool, takeUnit, getAvailable } from './pool'
import type { Pool } from './pool'
import type { Drafter, Board, ShopOffer } from './drafter'
import type { CatalogUnit } from '../unit-catalog'
import { makePRNG } from '../rng'

const SHOP_SIZE = 5
const BOARD_SIZE = 6 // max units per drafter
const ROUNDS = 6    // each drafter picks 6 units total (one per round)

export interface DraftResult {
  drafterId: number
  board: CatalogUnit[]
}

export interface LobbyResult {
  drafts: DraftResult[]
  totalPicked: number
  poolExhausted: boolean
  denials: number // times a drafter's top choice was unavailable
}

/**
 * Run a complete draft lobby with the given drafters.
 * Each drafter picks ROUNDS times from a random SHOP_SIZE offer.
 */
export function runLobby(
  drafters: Drafter[],
  seed: number,
): LobbyResult {
  const pool = createPool()
  const rng = makePRNG(seed)
  const boards: Board[] = drafters.map(() => [])
  let totalPicked = 0
  let denials = 0

  for (let round = 0; round < ROUNDS; round++) {
    for (let di = 0; di < drafters.length; di++) {
      const available = getAvailable(pool)
      if (available.length === 0) {
        denials++
        continue
      }
      // Build a random shop offer
      const poolCopy = [...available]
      const shop: ShopOffer = []
      for (let i = 0; i < SHOP_SIZE && poolCopy.length > 0; i++) {
        const idx = rng.nextInt(poolCopy.length)
        shop.push(poolCopy[idx])
        poolCopy.splice(idx, 1)
      }

      const pickSeed = seed * 1000 + round * 100 + di
      const picked = drafters[di].pick(shop, boards[di], pickSeed)

      if (picked !== null) {
        const unit = takeUnit(pool, picked)
        if (unit) {
          boards[di].push(unit)
          totalPicked++
        } else {
          denials++ // top pick was taken by concurrent drafter
        }
      }
    }
  }

  const remaining = [...pool.values()].reduce((s, e) => s + e.available, 0)

  return {
    drafts: boards.map((board, i) => ({ drafterId: i, board })),
    totalPicked,
    poolExhausted: remaining === 0,
    denials,
  }
}
