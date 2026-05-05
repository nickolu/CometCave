import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Grim spectral card', () => {
  it('destroys 1 card and adds 2 enhanced Aces', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = game.ownedCardIds.slice(0, 5)
    const initialOwned = game.ownedCardIds.length
    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [{ card: { id: 'grim-1', spectralType: 'grim' } as any, type: 'spectralCard', cardType: 'spectralCard', price: 0 }],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'grim-1' })
    expect(after.ownedCardIds.length).toBe(initialOwned + 1)
  })
})
