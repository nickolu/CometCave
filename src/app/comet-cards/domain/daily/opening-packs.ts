import { getPackDefinition, initializePackState } from '@/app/comet-cards/domain/booster-pack/utils'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import type { PackState } from '@/app/comet-cards/domain/shop/types'

import { LAST_ANTE_OPENING_PACKS } from './constants'

/**
 * The free packs a Last Ante run opens with.
 *
 * `initializePackState` seeds each pack partly off how many packs are already
 * on the shelf, so the packs must be built one at a time against a growing
 * list — building them all against an empty shelf hands out six identical
 * packs.
 */
export function buildOpeningPacks(game: GameState): PackState[] {
  const packs: PackState[] = []

  for (const spec of LAST_ANTE_OPENING_PACKS) {
    const withShelf: GameState = {
      ...game,
      shopState: { ...game.shopState, packsForSale: packs },
    }
    packs.push({
      ...initializePackState(withShelf, getPackDefinition(spec.cardType, spec.rarity)),
      isFree: true,
    })
  }

  return packs
}
