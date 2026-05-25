import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Wraith spectral card', () => {
  it('creates a rare joker and sets money to $0', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.money = 50
    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        {
          card: { id: 'wraith-1', spectralType: 'wraith' } as any,
          type: 'spectralCard',
          price: 0,
        },
      ],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }

    const initialJokers = game.jokers.length
    const after = reduceGame(game, {
      type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK',
      id: 'wraith-1',
    })

    expect(after.jokers.length).toBe(initialJokers + 1)
    expect(after.money).toBe(0)
  })
})
