import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithSun(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const sunCard = {
    id: 'sun-1',
    consumableType: 'tarotCard' as const,
    name: 'The Sun',
    isFaceUp: true,
    tarotType: 'theSun' as const,
  }
  game.consumables = [sunCard]
  game.gamePlayState.selectedConsumable = sunCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The Sun tarot card', () => {
  it('converts the selected card suit to hearts', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const originalPlayingCardId = game.cards[cardId].playingCardId
    const value = originalPlayingCardId.split('_')[0]

    const gameWithSun = makeGameWithSun([cardId])
    const after = reduceGame(gameWithSun, { type: 'TAROT_CARD_USED' })

    expect(after.cards[cardId].playingCardId).toBe(`${value}_hearts`)
  })

  it('converts up to 3 selected cards to hearts', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardIds = game.ownedCardIds.slice(0, 3)

    const gameWithSun = makeGameWithSun(cardIds)
    const after = reduceGame(gameWithSun, { type: 'TAROT_CARD_USED' })

    for (const cardId of cardIds) {
      expect(after.cards[cardId].playingCardId).toMatch(/_hearts$/)
    }
  })
})
