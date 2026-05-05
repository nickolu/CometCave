import { describe, expect, it } from 'vitest'
import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import { ghostDeck } from '@/app/comet-cards/domain/decks/ghost-deck'

describe('Ghost Deck', () => {
  it('has standard 52 cards', () => {
    expect(ghostDeck.cards).toHaveLength(52)
  })

  it('starts with spectralInArcanaPacks enabled (via omenGlobe voucher)', () => {
    const game = createGameStateWithDeck('ghostDeck')
    expect(game.staticRules.spectralInArcanaPacks).toBe(true)
  })

  it('starts with a Hex spectral card in consumables', () => {
    const game = createGameStateWithDeck('ghostDeck')
    const hexCard = game.consumables.find(
      (c: any) => 'spectralType' in c && c.spectralType === 'hex'
    )
    expect(hexCard).toBeDefined()
  })
})
