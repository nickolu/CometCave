import { describe, expect, it } from 'vitest'

import { tarotCards } from '@/app/comet-cards/domain/consumable/tarot-cards'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

const deathCard = {
  id: 'death-1',
  consumableType: 'tarotCard' as const,
  name: 'Death',
  isFaceUp: true,
  tarotType: 'death' as const,
}

function makeGameWithDeath(game: GameState, selectedCardIds: string[]): GameState {
  game.consumables = [deathCard]
  game.gamePlayState.selectedConsumable = deathCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

describe('Death tarot card', () => {
  it('converts left card to have the same playingCardId as the right card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const leftCardId = game.ownedCardIds[0]
    const rightCardId = game.ownedCardIds[1]

    const rightPlayingCardId = game.cards[rightCardId].playingCardId

    const gameWithDeath = makeGameWithDeath(game, [leftCardId, rightCardId])
    const after = reduceGame(gameWithDeath, { type: 'TAROT_CARD_USED' })

    expect(after.cards[leftCardId].playingCardId).toBe(rightPlayingCardId)
  })

  it('converts left card to have the same enchantment as the right card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const leftCardId = game.ownedCardIds[0]
    const rightCardId = game.ownedCardIds[1]

    game.cards[rightCardId].flags.enchantment = 'lucky'

    const gameWithDeath = makeGameWithDeath(game, [leftCardId, rightCardId])
    const after = reduceGame(gameWithDeath, { type: 'TAROT_CARD_USED' })

    expect(after.cards[leftCardId].flags.enchantment).toBe('lucky')
  })

  it('converts left card to have the same bonusChips as the right card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const leftCardId = game.ownedCardIds[0]
    const rightCardId = game.ownedCardIds[1]

    game.cards[rightCardId].bonusChips = 15

    const gameWithDeath = makeGameWithDeath(game, [leftCardId, rightCardId])
    const after = reduceGame(gameWithDeath, { type: 'TAROT_CARD_USED' })

    expect(after.cards[leftCardId].bonusChips).toBe(15)
  })

  it('does not modify the right card', () => {
    const game: GameState = structuredClone(defaultGameState)
    const leftCardId = game.ownedCardIds[0]
    const rightCardId = game.ownedCardIds[1]

    const rightPlayingCardId = game.cards[rightCardId].playingCardId

    const gameWithDeath = makeGameWithDeath(game, [leftCardId, rightCardId])
    const after = reduceGame(gameWithDeath, { type: 'TAROT_CARD_USED' })

    expect(after.cards[rightCardId].playingCardId).toBe(rightPlayingCardId)
  })

  it('is not playable with fewer than 2 cards selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = game.ownedCardIds[0]
    const gameWithDeath = makeGameWithDeath(game, [cardId])

    expect(tarotCards.death.isPlayable(gameWithDeath)).toBe(false)
  })

  it('is playable with 2 or more cards selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    const leftCardId = game.ownedCardIds[0]
    const rightCardId = game.ownedCardIds[1]
    const gameWithDeath = makeGameWithDeath(game, [leftCardId, rightCardId])

    expect(tarotCards.death.isPlayable(gameWithDeath)).toBe(true)
  })
})
