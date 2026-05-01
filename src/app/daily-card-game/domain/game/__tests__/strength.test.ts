import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

function makeGameWithStrength(selectedCardIds: string[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const strengthCard = {
    id: 'strength-1',
    consumableType: 'tarotCard' as const,
    name: 'Strength',
    isFaceUp: true,
    tarotType: 'strength' as const,
  }
  game.consumables = [strengthCard]
  game.gamePlayState.selectedConsumable = strengthCard
  game.gamePlayState.selectedCardIds = selectedCardIds
  return game
}

function findCardByPlayingCardId(game: GameState, playingCardId: string): string | undefined {
  return game.ownedCardIds.find(id => game.cards[id].playingCardId === playingCardId)
}

describe('Strength tarot card', () => {
  it('increases rank of a selected card by 1 (e.g. 5 -> 6)', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = findCardByPlayingCardId(game, '5_hearts')
    expect(cardId).toBeTruthy()

    const gameWithStrength = makeGameWithStrength([cardId!])
    const after = reduceGame(gameWithStrength, { type: 'TAROT_CARD_USED' })

    const suit = playingCards[game.cards[cardId!].playingCardId].suit
    expect(after.cards[cardId!].playingCardId).toBe(`6_${suit}`)
  })

  it('King becomes Ace', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = findCardByPlayingCardId(game, 'K_spades')
    expect(cardId).toBeTruthy()

    const gameWithStrength = makeGameWithStrength([cardId!])
    const after = reduceGame(gameWithStrength, { type: 'TAROT_CARD_USED' })

    expect(after.cards[cardId!].playingCardId).toBe('A_spades')
  })

  it('Ace wraps around to 2', () => {
    const game: GameState = structuredClone(defaultGameState)
    const cardId = findCardByPlayingCardId(game, 'A_hearts')
    expect(cardId).toBeTruthy()

    const gameWithStrength = makeGameWithStrength([cardId!])
    const after = reduceGame(gameWithStrength, { type: 'TAROT_CARD_USED' })

    expect(after.cards[cardId!].playingCardId).toBe('2_hearts')
  })

  it('applies to up to 2 selected cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    const card1Id = findCardByPlayingCardId(game, '5_hearts')
    const card2Id = findCardByPlayingCardId(game, '7_clubs')
    expect(card1Id).toBeTruthy()
    expect(card2Id).toBeTruthy()

    const gameWithStrength = makeGameWithStrength([card1Id!, card2Id!])
    const after = reduceGame(gameWithStrength, { type: 'TAROT_CARD_USED' })

    expect(after.cards[card1Id!].playingCardId).toBe('6_hearts')
    expect(after.cards[card2Id!].playingCardId).toBe('8_clubs')
  })

  it('only applies to first 2 cards when more than 2 are selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    const card1Id = findCardByPlayingCardId(game, '5_hearts')
    const card2Id = findCardByPlayingCardId(game, '7_clubs')
    const card3Id = findCardByPlayingCardId(game, '9_diamonds')
    expect(card1Id).toBeTruthy()
    expect(card2Id).toBeTruthy()
    expect(card3Id).toBeTruthy()

    const gameWithStrength = makeGameWithStrength([card1Id!, card2Id!, card3Id!])
    const after = reduceGame(gameWithStrength, { type: 'TAROT_CARD_USED' })

    expect(after.cards[card1Id!].playingCardId).toBe('6_hearts')
    expect(after.cards[card2Id!].playingCardId).toBe('8_clubs')
    expect(after.cards[card3Id!].playingCardId).toBe('9_diamonds')
  })
})
