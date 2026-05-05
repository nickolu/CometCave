import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithHangedMan(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const hangedManCard = {
    id: 'hanged-man-1',
    consumableType: 'tarotCard' as const,
    name: 'The Hanged Man',
    isFaceUp: true,
    tarotType: 'theHangedMan' as const,
  }
  game.consumables = [hangedManCard]
  game.gamePlayState.selectedConsumable = hangedManCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The Hanged Man tarot card', () => {
  it('removes a selected card from ownedCardIds', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithHangedMan = makeGameWithHangedMan([cardId])

    const after = reduceGame(gameWithHangedMan, { type: 'TAROT_CARD_USED' })
    expect(after.ownedCardIds).not.toContain(cardId)
  })

  it('removes a selected card from the cards registry', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithHangedMan = makeGameWithHangedMan([cardId])

    const after = reduceGame(gameWithHangedMan, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId]).toBeUndefined()
  })

  it('removes up to 2 selected cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId1 = game.ownedCardIds[0]
    const cardId2 = game.ownedCardIds[1]
    const gameWithHangedMan = makeGameWithHangedMan([cardId1, cardId2])

    const after = reduceGame(gameWithHangedMan, { type: 'TAROT_CARD_USED' })
    expect(after.ownedCardIds).not.toContain(cardId1)
    expect(after.ownedCardIds).not.toContain(cardId2)
    expect(after.cards[cardId1]).toBeUndefined()
    expect(after.cards[cardId2]).toBeUndefined()
  })

  it('only removes the first 2 cards when more than 2 are selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId1 = game.ownedCardIds[0]
    const cardId2 = game.ownedCardIds[1]
    const cardId3 = game.ownedCardIds[2]
    const gameWithHangedMan = makeGameWithHangedMan([cardId1, cardId2, cardId3])

    const after = reduceGame(gameWithHangedMan, { type: 'TAROT_CARD_USED' })
    expect(after.ownedCardIds).not.toContain(cardId1)
    expect(after.ownedCardIds).not.toContain(cardId2)
    expect(after.ownedCardIds).toContain(cardId3)
  })
})
