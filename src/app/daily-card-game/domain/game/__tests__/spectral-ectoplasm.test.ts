import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Ectoplasm spectral card', () => {
  it('adds Negative edition to a random joker and reduces hand size by 1', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      { id: 'j1', jokerId: 'joker', edition: 'normal', counter: 0, flags: {} } as any,
    ]
    const initialHandSize = game.handSizeModifier

    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        {
          card: { id: 'ecto-1', spectralType: 'ectoplasm' } as any,
          type: 'spectralCard',
          cardType: 'spectralCard',
          price: 0,
        },
      ],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }

    const after = reduceGame(game, {
      type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK',
      id: 'ecto-1',
    })

    expect(after.jokers[0].edition).toBe('negative')
    expect(after.handSizeModifier).toBe(initialHandSize - 1)
  })
})
