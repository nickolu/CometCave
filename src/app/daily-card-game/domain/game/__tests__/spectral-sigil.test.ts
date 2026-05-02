import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Sigil spectral card', () => {
  it('converts all hand cards to the same suit', () => {
    const game: GameState = structuredClone(defaultGameState)
    const handCardIds = game.ownedCardIds.slice(0, 5)
    game.gamePlayState.handIds = handCardIds

    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        {
          card: { id: 'sigil-1', spectralType: 'sigil' } as any,
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
      id: 'sigil-1',
    })

    const handSuits = after.gamePlayState.handIds.map(id => {
      const card = after.cards[id]
      if (!card || !('playingCardId' in card)) return null
      return playingCards[card.playingCardId]?.suit
    }).filter(Boolean)

    const uniqueSuits = new Set(handSuits)
    expect(uniqueSuits.size).toBe(1)
  })
})
