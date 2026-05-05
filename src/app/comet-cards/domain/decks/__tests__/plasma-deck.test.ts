import { describe, expect, it } from 'vitest'

import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import { plasmaDeck } from '@/app/comet-cards/domain/decks/plasma-deck'

describe('Plasma Deck', () => {
  it('has correct metadata', () => {
    expect(plasmaDeck.id).toBe('plasmaDeck')
    expect(plasmaDeck.name).toBe('Plasma Deck')
    expect(plasmaDeck.modifiers).toEqual({})
  })

  it('has standard 52 cards', () => {
    expect(plasmaDeck.cards).toHaveLength(52)
  })

  it('doubles blind requirements when selected', () => {
    const gameState = createGameStateWithDeck('plasmaDeck')
    // Normal first round baseAnte is 100n, Plasma should be 200n
    expect(gameState.rounds[0].baseAnte).toBe(200n)
    // Normal second round baseAnte is 300n, Plasma should be 600n
    expect(gameState.rounds[1].baseAnte).toBe(600n)
  })

  it('does not double blinds for other decks', () => {
    const gameState = createGameStateWithDeck('pokerDeck')
    expect(gameState.rounds[0].baseAnte).toBe(100n)
    expect(gameState.rounds[1].baseAnte).toBe(300n)
  })
})
