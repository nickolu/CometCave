import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithHierophant(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const hierophantCard = {
    id: 'hierophant-1',
    consumableType: 'tarotCard' as const,
    name: 'The Hierophant',
    isFaceUp: true,
    tarotType: 'theHierophant' as const,
  }
  game.consumables = [hierophantCard]
  game.gamePlayState.selectedConsumable = hierophantCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The Hierophant tarot card', () => {
  it('sets bonus enchantment on 1 selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithHierophant = makeGameWithHierophant([cardId])

    const after = reduceGame(gameWithHierophant, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('bonus')
  })

  it('sets bonus enchantment on up to 2 selected cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId1 = game.ownedCardIds[0]
    const cardId2 = game.ownedCardIds[1]
    const gameWithHierophant = makeGameWithHierophant([cardId1, cardId2])

    const after = reduceGame(gameWithHierophant, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId1].flags.enchantment).toBe('bonus')
    expect(after.cards[cardId2].flags.enchantment).toBe('bonus')
  })
})
