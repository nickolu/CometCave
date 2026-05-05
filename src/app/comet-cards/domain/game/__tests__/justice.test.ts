import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithJustice(selectedCardId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const justiceCard = {
    id: 'justice-1',
    consumableType: 'tarotCard' as const,
    name: 'Justice',
    isFaceUp: true,
    tarotType: 'justice' as const,
  }
  game.consumables = [justiceCard]
  game.gamePlayState.selectedConsumable = justiceCard
  game.gamePlayState.selectedCardIds = [selectedCardId]
  return game
}

describe('Justice tarot card', () => {
  it('sets glass enchantment on the selected card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithJustice = makeGameWithJustice(cardId)

    const after = reduceGame(gameWithJustice, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('glass')
  })

  it('changes a card with an existing enchantment to glass', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithJustice = makeGameWithJustice(cardId)
    gameWithJustice.cards[cardId].flags.enchantment = 'lucky'

    const after = reduceGame(gameWithJustice, { type: 'TAROT_CARD_USED' })
    expect(after.cards[cardId].flags.enchantment).toBe('glass')
  })
})
