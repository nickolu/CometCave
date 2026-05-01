import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithDevil(selectedCardId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const devilCard = {
    id: 'devil-1',
    consumableType: 'tarotCard' as const,
    name: 'The Devil',
    isFaceUp: true,
    tarotType: 'theDevil' as const,
  }
  game.consumables = [devilCard]
  game.gamePlayState.selectedConsumable = devilCard
  game.gamePlayState.selectedCardIds = [selectedCardId]
  return game
}

describe('The Devil tarot card', () => {
  it('sets gold enchantment on the selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithDevil = makeGameWithDevil(cardId)

    const after = reduceGame(gameWithDevil, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('gold')
  })

  it('changes a card with an existing enchantment to gold', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithDevil = makeGameWithDevil(cardId)
    gameWithDevil.cards[cardId].flags.enchantment = 'lucky'

    const after = reduceGame(gameWithDevil, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('gold')
  })
})
