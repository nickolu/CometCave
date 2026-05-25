import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Sigil spectral card', () => {
  it('converts all hand cards to the same suit', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = game.ownedCardIds.slice(0, 5)
    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [{ card: { id: 'sigil-1', spectralType: 'sigil' } as any, type: 'spectralCard', price: 0 }],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'sigil-1' })
    const suits = after.gamePlayState.handIds.map(id => {
      const c = after.cards[id]
      return c && 'playingCardId' in c ? playingCards[c.playingCardId]?.suit : null
    }).filter(Boolean)
    expect(new Set(suits).size).toBe(1)
  })
})
