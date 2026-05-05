import { describe, expect, it } from 'vitest'

import {
  applyDeckModifiers,
  createGameStateWithDeck,
  defaultGameState,
} from '@/app/comet-cards/domain/game/default-game-state'
import { yellowDeck } from '@/app/comet-cards/domain/decks/yellow-deck'

describe('Yellow Deck', () => {
  it('has 52 cards', () => {
    expect(yellowDeck.cards).toHaveLength(52)
  })

  it('has +10 money modifier', () => {
    expect(yellowDeck.modifiers.money).toBe(10)
  })

  it('has the correct id, name and description', () => {
    expect(yellowDeck.id).toBe('yellowDeck')
    expect(yellowDeck.name).toBe('Yellow Deck')
    expect(yellowDeck.description).toBe('+$10 starting money')
  })

  it('when applied to a game state, money becomes 10', () => {
    const base = structuredClone(defaultGameState)
    const modified = applyDeckModifiers(base, yellowDeck)
    expect(modified.money).toBe(10)
  })

  it('createGameStateWithDeck initializes a game with money 10 for Yellow Deck', () => {
    const state = createGameStateWithDeck('yellowDeck')
    expect(state.money).toBe(10)
    expect(state.selectedDeck).toBe('yellowDeck')
  })

  it('createGameStateWithDeck with Yellow Deck has 52 owned cards', () => {
    const state = createGameStateWithDeck('yellowDeck')
    expect(state.ownedCardIds).toHaveLength(52)
  })
})
