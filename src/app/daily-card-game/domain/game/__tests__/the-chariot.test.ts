import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithChariot(selectedCardId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const chariotCard = {
    id: 'chariot-1',
    consumableType: 'tarotCard' as const,
    name: 'The Chariot',
    isFaceUp: true,
    tarotType: 'theChariot' as const,
  }
  game.consumables = [chariotCard]
  game.gamePlayState.selectedConsumable = chariotCard
  game.gamePlayState.selectedCardIds = [selectedCardId]
  return game
}

describe('The Chariot tarot card', () => {
  it('sets steel enchantment on the selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithChariot = makeGameWithChariot(cardId)

    const after = reduceGame(gameWithChariot, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('steel')
  })

  it('changes a card with an existing enchantment to steel', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithChariot = makeGameWithChariot(cardId)
    gameWithChariot.cards[cardId].flags.enchantment = 'lucky'

    const after = reduceGame(gameWithChariot, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('steel')
  })
})
