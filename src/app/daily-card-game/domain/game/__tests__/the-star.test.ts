import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithStar(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const starCard = {
    id: 'star-1',
    consumableType: 'tarotCard' as const,
    name: 'The Star',
    isFaceUp: true,
    tarotType: 'theStar' as const,
  }
  game.consumables = [starCard]
  game.gamePlayState.selectedConsumable = starCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The Star tarot card', () => {
  it('converts the selected card suit to diamonds', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const originalPlayingCardId = game.cards[cardId].playingCardId
    const value = originalPlayingCardId.split('_')[0]

    const gameWithStar = makeGameWithStar([cardId])
    const after = reduceGame(gameWithStar, { type: 'TAROT_CARD_USED' })

    expect(after.cards[cardId].playingCardId).toBe(`${value}_diamonds`)
  })

  it('converts up to 3 selected cards to diamonds', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardIds = game.ownedCardIds.slice(0, 3)

    const gameWithStar = makeGameWithStar(cardIds)
    const after = reduceGame(gameWithStar, { type: 'TAROT_CARD_USED' })

    for (const cardId of cardIds) {
      expect(after.cards[cardId].playingCardId).toMatch(/_diamonds$/)
    }
  })

  it('only converts the first 3 cards when more than 3 are selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardIds = game.ownedCardIds.slice(0, 4)
    const fourthCardId = cardIds[3]
    const originalFourthPlayingCardId = game.cards[fourthCardId].playingCardId

    const gameWithStar = makeGameWithStar(cardIds)
    const after = reduceGame(gameWithStar, { type: 'TAROT_CARD_USED' })

    // First 3 should be diamonds
    for (const cardId of cardIds.slice(0, 3)) {
      expect(after.cards[cardId].playingCardId).toMatch(/_diamonds$/)
    }
    // Fourth should be unchanged
    expect(after.cards[fourthCardId].playingCardId).toBe(originalFourthPlayingCardId)
  })
})
