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

describe('Seal spectral cards', () => {
  it('Talisman adds Gold seal', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = [game.ownedCardIds[0]]
    game.shopState.openPackState = makePackWithSpectral('t-1', 'talisman')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 't-1' })
    const card = after.cards[game.ownedCardIds[0]]
    expect('flags' in card && card.flags.seal).toBe('gold')
  })

  it('Deja Vu adds Red seal', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = [game.ownedCardIds[0]]
    game.shopState.openPackState = makePackWithSpectral('d-1', 'dejaVu')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'd-1' })
    const card = after.cards[game.ownedCardIds[0]]
    expect('flags' in card && card.flags.seal).toBe('red')
  })

  it('Trance adds Blue seal', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = [game.ownedCardIds[0]]
    game.shopState.openPackState = makePackWithSpectral('tr-1', 'trance')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'tr-1' })
    const card = after.cards[game.ownedCardIds[0]]
    expect('flags' in card && card.flags.seal).toBe('blue')
  })

  it('Medium adds Purple seal', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePlayState.handIds = [game.ownedCardIds[0]]
    game.shopState.openPackState = makePackWithSpectral('m-1', 'medium')
    const after = reduceGame(game, { type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK', id: 'm-1' })
    const card = after.cards[game.ownedCardIds[0]]
    expect('flags' in card && card.flags.seal).toBe('purple')
  })
})
