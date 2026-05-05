import { describe, expect, it } from 'vitest'

import {
  createGameStateWithDeck,
  defaultGameState,
} from '@/app/comet-cards/domain/game/default-game-state'
import { paintedDeck } from '@/app/comet-cards/domain/decks/painted-deck'

describe('Painted Deck', () => {
  it('has 52 cards', () => {
    expect(paintedDeck.cards).toHaveLength(52)
  })

  it('has correct modifiers', () => {
    expect(paintedDeck.modifiers.handSizeModifier).toBe(2)
    expect(paintedDeck.modifiers.maxJokers).toBe(-1)
  })

  it('createGameStateWithDeck has +2 hand size and -1 joker slot', () => {
    const state = createGameStateWithDeck('paintedDeck')
    const base = structuredClone(defaultGameState)
    expect(state.handSizeModifier).toBe(base.handSizeModifier + 2)
    expect(state.maxJokers).toBe(base.maxJokers - 1)
  })
})
