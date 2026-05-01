import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithTower(selectedCardId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const towerCard = {
    id: 'tower-1',
    consumableType: 'tarotCard' as const,
    name: 'The Tower',
    isFaceUp: true,
    tarotType: 'theTower' as const,
  }
  game.consumables = [towerCard]
  game.gamePlayState.selectedConsumable = towerCard
  game.gamePlayState.selectedCardIds = [selectedCardId]
  return game
}

describe('The Tower tarot card', () => {
  it('sets stone enchantment on the selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithTower = makeGameWithTower(cardId)

    const after = reduceGame(gameWithTower, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('stone')
  })

  it('changes a card with an existing enchantment to stone', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    game.cards[cardId].flags.enchantment = 'lucky'
    const gameWithTower = makeGameWithTower(cardId)
    // Carry over the pre-set enchantment
    gameWithTower.cards[cardId].flags.enchantment = 'lucky'

    const after = reduceGame(gameWithTower, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('stone')
  })
})
