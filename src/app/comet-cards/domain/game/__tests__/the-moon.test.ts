import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithMoon(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const moonCard = {
    id: 'moon-1',
    consumableType: 'tarotCard' as const,
    name: 'The Moon',
    isFaceUp: true,
    tarotType: 'theMoon' as const,
  }
  game.consumables = [moonCard]
  game.gamePlayState.selectedConsumable = moonCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The Moon tarot card', () => {
  it('converts the selected card suit to clubs', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const originalPlayingCardId = game.cards[cardId].playingCardId
    const value = originalPlayingCardId.split('_')[0]

    const gameWithMoon = makeGameWithMoon([cardId])
    const after = reduceGame(gameWithMoon, { type: 'TAROT_CARD_USED' })

    expect(after.cards[cardId].playingCardId).toBe(`${value}_clubs`)
  })

  it('converts up to 3 selected cards to clubs', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardIds = game.ownedCardIds.slice(0, 3)

    const gameWithMoon = makeGameWithMoon(cardIds)
    const after = reduceGame(gameWithMoon, { type: 'TAROT_CARD_USED' })

    for (const cardId of cardIds) {
      expect(after.cards[cardId].playingCardId).toMatch(/_clubs$/)
    }
  })
})
