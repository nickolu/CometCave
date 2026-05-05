import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

describe('comet-cards shop buy effects', () => {
  it('runs SHOP_BUY_CARD effects for a purchased Four Fingers joker', () => {
    const game: GameState = structuredClone(defaultGameState)

    // Start with no Four Fingers in play so we can observe the purchase applying the rule.
    game.jokers = []
    game.staticRules.numberOfCardsRequiredForFlushAndStraight = 5

    const fourFingersState = initializeJoker(jokers.fourFingersJoker, game)
    const buyable: BuyableCard = {
      type: 'jokerCard',
      card: fourFingersState,
      price: jokers.fourFingersJoker.price,
    }

    game.money = 999
    game.shopState.cardsForSale = [buyable]
    game.shopState.selectedCardId = fourFingersState.id

    const afterPurchase = reduceGame(game, { type: 'SHOP_BUY_CARD' })

    expect(afterPurchase.jokers.some(j => j.jokerId === jokers.fourFingersJoker.id)).toBe(true)
    expect(afterPurchase.staticRules.numberOfCardsRequiredForFlushAndStraight).toBe(4)
  })
})
