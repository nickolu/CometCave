import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Ouija spectral card', () => {
  it('converts all hand cards to same rank and reduces hand size', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = game.ownedCardIds.slice(0, 5)
    const initialHandSize = game.handSizeModifier
    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [{ card: { id: 'ouija-1', spectralType: 'ouija' } as any, type: 'spectralCard', cardType: 'spectralCard', price: 0 }],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'ouija-1' })
    const values = after.gamePlayState.handIds.map(id => {
      const c = after.cards[id]
      return c && 'playingCardId' in c ? playingCards[c.playingCardId]?.value : null
    }).filter(Boolean)
    expect(new Set(values).size).toBe(1)
    expect(after.handSizeModifier).toBe(initialHandSize - 1)
  })
})
