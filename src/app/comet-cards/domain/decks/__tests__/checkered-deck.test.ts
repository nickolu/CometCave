import { describe, expect, it } from 'vitest'

import { checkeredDeck } from '@/app/comet-cards/domain/decks/checkered-deck'

describe('Checkered Deck', () => {
  it('has 52 cards', () => {
    expect(checkeredDeck.cards).toHaveLength(52)
  })

  it('has only spades and hearts suits', () => {
    const invalidSuits = checkeredDeck.cards.filter(
      card => card.suit !== 'spades' && card.suit !== 'hearts',
    )
    expect(invalidSuits).toHaveLength(0)
  })

  it('has 26 spades and 26 hearts', () => {
    const spades = checkeredDeck.cards.filter(card => card.suit === 'spades')
    const hearts = checkeredDeck.cards.filter(card => card.suit === 'hearts')
    expect(spades).toHaveLength(26)
    expect(hearts).toHaveLength(26)
  })

  it('has each rank appearing twice in spades and twice in hearts', () => {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    for (const rank of ranks) {
      const spadesOfRank = checkeredDeck.cards.filter(
        card => card.value === rank && card.suit === 'spades',
      )
      const heartsOfRank = checkeredDeck.cards.filter(
        card => card.value === rank && card.suit === 'hearts',
      )
      expect(spadesOfRank).toHaveLength(2)
      expect(heartsOfRank).toHaveLength(2)
    }
  })

  it('has no diamonds or clubs', () => {
    const diamonds = checkeredDeck.cards.filter(card => card.suit === 'diamonds')
    const clubs = checkeredDeck.cards.filter(card => card.suit === 'clubs')
    expect(diamonds).toHaveLength(0)
    expect(clubs).toHaveLength(0)
  })

  it('has empty modifiers', () => {
    expect(checkeredDeck.modifiers).toEqual({})
  })
})
