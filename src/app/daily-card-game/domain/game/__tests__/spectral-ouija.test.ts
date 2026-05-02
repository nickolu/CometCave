import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Ouija spectral card', () => {
  it('converts all hand cards to same rank and reduces hand size by 1', () => {
    const game: GameState = structuredClone(defaultGameState)
    const handCardIds = game.ownedCardIds.slice(0, 5)
    game.gamePlayState.handIds = handCardIds
    const initialHandSize = game.handSizeModifier

    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        {
          card: { id: 'ouija-1', spectralType: 'ouija' } as any,
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
      id: 'ouija-1',
    })

    // All hand cards should have the same value
    const handValues = after.gamePlayState.handIds.map(id => {
      const card = after.cards[id]
      if (!card || !('playingCardId' in card)) return null
      return playingCards[card.playingCardId]?.value
    }).filter(Boolean)

    const uniqueValues = new Set(handValues)
    expect(uniqueValues.size).toBe(1)

    // Hand size reduced
    expect(after.handSizeModifier).toBe(initialHandSize - 1)
  })
})
