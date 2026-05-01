import { describe, expect, it } from 'vitest'

import {
  applyDeckModifiers,
  createGameStateWithDeck,
  defaultGameState,
} from '@/app/daily-card-game/domain/game/default-game-state'
import { redDeck } from '@/app/daily-card-game/domain/decks/red-deck'

describe('Red Deck', () => {
  it('has 52 cards', () => {
    expect(redDeck.cards).toHaveLength(52)
  })

  it('has +1 maxDiscards modifier', () => {
    expect(redDeck.modifiers.maxDiscards).toBe(1)
  })

  it('has the correct id, name and description', () => {
    expect(redDeck.id).toBe('redDeck')
    expect(redDeck.name).toBe('Red Deck')
    expect(redDeck.description).toBe('+1 discard every round')
  })

  it('when applied to a game state, maxDiscards becomes 4', () => {
    const base = structuredClone(defaultGameState)
    const modified = applyDeckModifiers(base, redDeck)
    expect(modified.maxDiscards).toBe(4)
  })

  it('when applied to a game state, remainingDiscards starts at 4', () => {
    const base = structuredClone(defaultGameState)
    const modified = applyDeckModifiers(base, redDeck)
    expect(modified.gamePlayState.remainingDiscards).toBe(4)
  })

  it('createGameStateWithDeck initializes a game with maxDiscards 4 for Red Deck', () => {
    const state = createGameStateWithDeck('redDeck')
    expect(state.maxDiscards).toBe(4)
    expect(state.gamePlayState.remainingDiscards).toBe(4)
    expect(state.selectedDeck).toBe('redDeck')
  })

  it('createGameStateWithDeck with Red Deck has 52 owned cards', () => {
    const state = createGameStateWithDeck('redDeck')
    expect(state.ownedCardIds).toHaveLength(52)
  })
})
