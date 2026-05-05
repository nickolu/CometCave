import { describe, expect, it } from 'vitest'

import { erraticDeck, generateErraticDeckCards } from '@/app/comet-cards/domain/decks/erratic-deck'
import { CardValue } from '@/app/comet-cards/domain/playing-card/types'

const ALL_VALUES: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const ALL_SUITS = ['hearts', 'diamonds', 'clubs', 'spades']

describe('Erratic Deck', () => {
  it('has correct metadata', () => {
    expect(erraticDeck.id).toBe('erraticDeck')
    expect(erraticDeck.name).toBe('Erratic Deck')
    expect(erraticDeck.modifiers).toEqual({})
  })

  it('generates 52 cards', () => {
    const cards = generateErraticDeckCards('test-seed')
    expect(cards).toHaveLength(52)
  })

  it('generates cards with valid ranks and suits', () => {
    const cards = generateErraticDeckCards('test-seed')
    for (const card of cards) {
      expect(ALL_VALUES).toContain(card.value)
      expect(ALL_SUITS).toContain(card.suit)
    }
  })

  it('generates deterministic cards for the same seed', () => {
    const cards1 = generateErraticDeckCards('seed-abc')
    const cards2 = generateErraticDeckCards('seed-abc')
    expect(cards1).toEqual(cards2)
  })

  it('generates different cards for different seeds', () => {
    const cards1 = generateErraticDeckCards('seed-one')
    const cards2 = generateErraticDeckCards('seed-two')
    const sameCount = cards1.filter(
      (card, i) => card.value === cards2[i].value && card.suit === cards2[i].suit,
    ).length
    expect(sameCount).toBeLessThan(52)
  })
})
