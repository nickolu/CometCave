import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithEmpress(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const empressCard = {
    id: 'empress-1',
    consumableType: 'tarotCard' as const,
    name: 'The Empress',
    isFaceUp: true,
    tarotType: 'theEmpress' as const,
  }
  game.consumables = [empressCard]
  game.gamePlayState.selectedConsumable = empressCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('The Empress tarot card', () => {
  it('sets mult enchantment on 1 selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithEmpress = makeGameWithEmpress([cardId])

    const after = reduceGame(gameWithEmpress, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('mult')
  })

  it('sets mult enchantment on up to 2 selected cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId1 = game.ownedCardIds[0]
    const cardId2 = game.ownedCardIds[1]
    const gameWithEmpress = makeGameWithEmpress([cardId1, cardId2])

    const after = reduceGame(gameWithEmpress, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId1].flags.enchantment).toBe('mult')
    expect(after.cards[cardId2].flags.enchantment).toBe('mult')
  })
})
