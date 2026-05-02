import { describe, expect, it } from 'vitest'
import { applyDeckModifiers, defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { decks } from '@/app/daily-card-game/domain/decks/decks'

describe('Green Deck', () => {
  it('exists in the decks registry', () => {
    expect(decks.greenDeck).toBeDefined()
    expect(decks.greenDeck.name).toBe('Green Deck')
  })

  it('sets maxInterest to 0', () => {
    const game = applyDeckModifiers(structuredClone(defaultGameState), decks.greenDeck)
    expect(game.maxInterest).toBe(0)
  })

  it('uses standard 52 cards', () => {
    expect(decks.greenDeck.cards.length).toBe(52)
  })
})
