import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithWorld(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const worldCard = {
    id: 'world-1',
    consumableType: 'tarotCard' as const,
    name: 'The World',
    isFaceUp: true,
    tarotType: 'theWorld' as const,
  }
  game.consumables = [worldCard]
  game.gamePlayState.selectedConsumable = worldCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The World tarot card', () => {
  it('converts the selected card suit to spades', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const originalPlayingCardId = game.cards[cardId].playingCardId
    const value = originalPlayingCardId.split('_')[0]

    const gameWithWorld = makeGameWithWorld([cardId])
    const after = reduceGame(gameWithWorld, { type: 'TAROT_CARD_USED' })

    expect(after.cards[cardId].playingCardId).toBe(`${value}_spades`)
  })

  it('converts up to 3 selected cards to spades', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardIds = game.ownedCardIds.slice(0, 3)

    const gameWithWorld = makeGameWithWorld(cardIds)
    const after = reduceGame(gameWithWorld, { type: 'TAROT_CARD_USED' })

    for (const cardId of cardIds) {
      expect(after.cards[cardId].playingCardId).toMatch(/_spades$/)
    }
  })
})
