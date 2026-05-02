import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

const makePackWithSpectral = (id: string, spectralType: string) => ({
  id: 'test-pack',
  cards: [{ card: { id, spectralType } as any, type: 'spectralCard' as const, cardType: 'spectralCard' as const, price: 0 }],
  rarity: 'normal' as const,
  remainingCardsToSelect: 1,
})

describe('Aura spectral card', () => {
  it('adds a random edition to a card in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = [game.ownedCardIds[0]]
    game.shopState.openPackState = makePackWithSpectral('aura-1', 'aura')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'aura-1' })
    const card = after.cards[game.ownedCardIds[0]]
    expect('flags' in card && ['foil', 'holographic', 'polychrome'].includes(card.flags.edition)).toBe(true)
  })
})

describe('Cryptid spectral card', () => {
  it('creates 2 copies of a card in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = [game.ownedCardIds[0]]
    const initialOwned = game.ownedCardIds.length
    game.shopState.openPackState = makePackWithSpectral('crypt-1', 'cryptid')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'crypt-1' })
    expect(after.ownedCardIds.length).toBe(initialOwned + 2)
  })
})

describe('The Soul spectral card', () => {
  it('creates a legendary joker', () => {
    const game: GameState = structuredClone(defaultGameState)
    const initialJokers = game.jokers.length
    game.shopState.openPackState = makePackWithSpectral('soul-1', 'theSoul')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'soul-1' })
    expect(after.jokers.length).toBe(initialJokers + 1)
  })
})
