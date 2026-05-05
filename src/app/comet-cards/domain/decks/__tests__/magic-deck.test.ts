import { describe, expect, it } from 'vitest'

import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import { magicDeck } from '@/app/comet-cards/domain/decks/magic-deck'

describe('Magic Deck', () => {
  it('has correct metadata', () => {
    expect(magicDeck.id).toBe('magicDeck')
    expect(magicDeck.name).toBe('Magic Deck')
  })

  it('has standard 52 cards', () => {
    expect(magicDeck.cards).toHaveLength(52)
  })

  it('starts with Crystal Ball voucher (+1 consumable slot)', () => {
    const gameState = createGameStateWithDeck('magicDeck')
    expect(gameState.vouchers).toHaveLength(1)
    expect(gameState.vouchers[0].type).toBe('crystalBall')
    // Crystal Ball gives +1 consumable slot (default 2 → 3)
    expect(gameState.maxConsumables).toBe(3)
  })

  it('starts with 2 tarot cards in consumables', () => {
    const gameState = createGameStateWithDeck('magicDeck')
    expect(gameState.consumables).toHaveLength(2)
    expect(gameState.consumables[0].consumableType).toBe('tarotCard')
    expect(gameState.consumables[1].consumableType).toBe('tarotCard')
  })

  it('generates deterministic tarot cards from game seed', () => {
    const gs1 = createGameStateWithDeck('magicDeck')
    const gs2 = createGameStateWithDeck('magicDeck')
    const types1 = gs1.consumables.map(c => 'tarotType' in c ? c.tarotType : null)
    const types2 = gs2.consumables.map(c => 'tarotType' in c ? c.tarotType : null)
    expect(types1).toEqual(types2)
  })
})
