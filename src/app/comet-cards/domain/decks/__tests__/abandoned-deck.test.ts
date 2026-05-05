import { describe, expect, it } from 'vitest'

import { abandonedDeck } from '@/app/comet-cards/domain/decks/abandoned-deck'

describe('Abandoned Deck', () => {
  it('has 40 cards', () => {
    expect(abandonedDeck.cards).toHaveLength(40)
  })

  it('has no face cards (J, Q, K)', () => {
    const faceValues = ['J', 'Q', 'K']
    const faceCards = abandonedDeck.cards.filter(card => faceValues.includes(card.value))
    expect(faceCards).toHaveLength(0)
  })

  it('has all 4 suits for each value 2-10 and A', () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades']
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
    for (const value of values) {
      for (const suit of suits) {
        const found = abandonedDeck.cards.find(card => card.value === value && card.suit === suit)
        expect(found).toBeDefined()
      }
    }
  })

  it('has empty modifiers', () => {
    expect(abandonedDeck.modifiers).toEqual({})
  })
})
