import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithLovers(selectedCardId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const loversCard = {
    id: 'lovers-1',
    consumableType: 'tarotCard' as const,
    name: 'The Lovers',
    isFaceUp: true,
    tarotType: 'theLovers' as const,
  }
  game.consumables = [loversCard]
  game.gamePlayState.selectedConsumable = loversCard
  game.gamePlayState.selectedCardIds = [selectedCardId]
  return game
}

describe('The Lovers tarot card', () => {
  it('sets wild enchantment on the selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithLovers = makeGameWithLovers(cardId)

    const after = reduceGame(gameWithLovers, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('wild')
  })

  it('changes a card with an existing enchantment to wild', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithLovers = makeGameWithLovers(cardId)
    gameWithLovers.cards[cardId].flags.enchantment = 'lucky'

    const after = reduceGame(gameWithLovers, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('wild')
  })
})
