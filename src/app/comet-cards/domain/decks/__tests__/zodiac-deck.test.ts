import { describe, expect, it } from 'vitest'

import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import { zodiacDeck } from '@/app/comet-cards/domain/decks/zodiac-deck'

describe('Zodiac Deck', () => {
  it('has correct metadata', () => {
    expect(zodiacDeck.id).toBe('zodiacDeck')
    expect(zodiacDeck.name).toBe('Zodiac Deck')
  })

  it('has standard 52 cards', () => {
    expect(zodiacDeck.cards).toHaveLength(52)
  })

  it('starts with 3 vouchers', () => {
    const gameState = createGameStateWithDeck('zodiacDeck')
    expect(gameState.vouchers).toHaveLength(3)
    const voucherTypes = gameState.vouchers.map(v => v.type)
    expect(voucherTypes).toContain('tarotMerchant')
    expect(voucherTypes).toContain('planetMerchant')
    expect(voucherTypes).toContain('overstock')
  })

  it('applies Tarot Merchant effect (2x tarot frequency)', () => {
    const gameState = createGameStateWithDeck('zodiacDeck')
    expect(gameState.shopState.tarotCard.multiplier).toBe(2)
  })

  it('applies Planet Merchant effect (2x celestial frequency)', () => {
    const gameState = createGameStateWithDeck('zodiacDeck')
    expect(gameState.shopState.celestialMultiplier).toBe(2)
  })

  it('applies Overstock effect (+1 card slot in shop)', () => {
    const gameState = createGameStateWithDeck('zodiacDeck')
    expect(gameState.shopState.maxCardsForSale).toBe(3)
  })
})
