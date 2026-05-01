import { describe, expect, it } from 'vitest'

import {
  createGameStateWithDeck,
  defaultGameState,
} from '@/app/daily-card-game/domain/game/default-game-state'
import { blackDeck } from '@/app/daily-card-game/domain/decks/black-deck'

describe('Black Deck', () => {
  it('has 52 cards', () => {
    expect(blackDeck.cards).toHaveLength(52)
  })

  it('has correct modifiers', () => {
    expect(blackDeck.modifiers.maxJokers).toBe(1)
    expect(blackDeck.modifiers.maxHands).toBe(-1)
  })

  it('createGameStateWithDeck has +1 joker slot and -1 hand', () => {
    const state = createGameStateWithDeck('blackDeck')
    const base = structuredClone(defaultGameState)
    expect(state.maxJokers).toBe(base.maxJokers + 1)
    expect(state.maxHands).toBe(base.maxHands - 1)
  })
})
