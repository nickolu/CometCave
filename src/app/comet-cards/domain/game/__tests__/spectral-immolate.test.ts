import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Immolate spectral card', () => {
  it('destroys up to 5 cards from hand and gains $20', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.money = 10
    game.gamePlayState.handIds = game.ownedCardIds.slice(0, 8)

    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        {
          card: { id: 'immolate-1', spectralType: 'immolate' } as any,
          type: 'spectralCard',
          cardType: 'spectralCard',
          price: 0,
        },
      ],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }

    const initialOwned = game.ownedCardIds.length
    const after = reduceGame(game, {
      type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK',
      id: 'immolate-1',
    })

    expect(after.ownedCardIds.length).toBe(initialOwned - 5)
    expect(after.money).toBe(30)
  })
})
