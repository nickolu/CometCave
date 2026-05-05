import { describe, expect, it } from 'vitest'

import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import { nebulaDeck } from '@/app/comet-cards/domain/decks/nebula-deck'

describe('Nebula Deck', () => {
  it('has correct metadata', () => {
    expect(nebulaDeck.id).toBe('nebulaDeck')
    expect(nebulaDeck.name).toBe('Nebula Deck')
  })

  it('has standard 52 cards', () => {
    expect(nebulaDeck.cards).toHaveLength(52)
  })

  it('reduces consumable slots by 1', () => {
    const gameState = createGameStateWithDeck('nebulaDeck')
    // Default is 2, -1 = 1
    expect(gameState.maxConsumables).toBe(1)
  })

  it('starts with Telescope voucher active', () => {
    const gameState = createGameStateWithDeck('nebulaDeck')
    expect(gameState.vouchers).toHaveLength(1)
    expect(gameState.vouchers[0].type).toBe('telescope')
    expect(gameState.staticRules.telescopeActive).toBe(true)
  })
})
