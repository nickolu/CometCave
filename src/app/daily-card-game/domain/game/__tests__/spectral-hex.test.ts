import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Hex spectral card', () => {
  it('adds Polychrome to a random joker and destroys the rest', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      { id: 'j1', jokerId: 'joker', edition: 'normal', counter: 0, flags: {} } as any,
      { id: 'j2', jokerId: 'jolly', edition: 'normal', counter: 0, flags: {} } as any,
      { id: 'j3', jokerId: 'zany', edition: 'normal', counter: 0, flags: {} } as any,
    ]

    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        { card: { id: 'hex-1', spectralType: 'hex' } as any, type: 'spectralCard', cardType: 'spectralCard', price: 0 },
      ],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }

    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'hex-1' })

    expect(after.jokers.length).toBe(1)
    expect(after.jokers[0].edition).toBe('polychrome')
  })
})
