import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { astronomer, jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard, PackState } from '@/app/comet-cards/domain/shop/types'

describe('Astronomer joker', () => {
  it('is defined with correct properties', () => {
    expect(astronomer.id).toBe('astronomer')
    expect(astronomer.name).toBe('Astronomer')
    expect(astronomer.rarity).toBe('uncommon')
    expect(astronomer.price).toBe(8)
    expect(astronomer.effects.length).toBe(0)
  })

  it('is registered in the jokers record', () => {
    expect(jokers.astronomer).toBeDefined()
    expect(jokers.astronomer.id).toBe('astronomer')
  })

  it('makes celestial cards in cardsForSale free after SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.astronomer, game)]

    const celestialCard: BuyableCard = {
      type: 'celestialCard',
      card: { id: 'c1', consumableType: 'celestialCard', handId: 'highCard' } as any,
      price: 3,
    }
    // Pre-populate guaranteedForSaleItems so SHOP_OPEN includes it
    game.shopState.guaranteedForSaleItems = [celestialCard]
    game.shopState.maxCardsForSale = 1

    const afterOpen = reduceGame(game, { type: 'SHOP_OPEN' })
    const celestialForSale = afterOpen.shopState.cardsForSale.find(
      c => c.card.id === 'c1'
    )
    expect(celestialForSale).toBeDefined()
    expect(celestialForSale?.price).toBe(0)
  })

  it('does not make non-celestial cards free after SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.astronomer, game)]

    const tarotCard: BuyableCard = {
      type: 'tarotCard',
      card: { id: 't1', consumableType: 'tarotCard', tarotType: 'theFool' } as any,
      price: 3,
    }
    game.shopState.guaranteedForSaleItems = [tarotCard]
    game.shopState.maxCardsForSale = 1

    const afterOpen = reduceGame(game, { type: 'SHOP_OPEN' })
    const tarotForSale = afterOpen.shopState.cardsForSale.find(c => c.card.id === 't1')
    expect(tarotForSale).toBeDefined()
    expect(tarotForSale?.price).toBe(3)
  })

  it('does not deduct money when opening a celestial pack', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.astronomer, game)]
    game.money = 10

    const celestialPack: PackState = {
      id: 'pack-1',
      rarity: 'normal',
      remainingCardsToSelect: 1,
      cards: [
        {
          type: 'celestialCard',
          card: { id: 'cp1', consumableType: 'celestialCard', handId: 'highCard' } as any,
          price: 0,
        },
      ],
    }
    game.shopState.packsForSale = [celestialPack]

    const afterOpen = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: 'pack-1' })
    expect(afterOpen.money).toBe(10)
  })

  it('still charges money for non-celestial packs', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.astronomer, game)]
    game.money = 10

    const tarotPack: PackState = {
      id: 'pack-2',
      rarity: 'normal',
      remainingCardsToSelect: 1,
      cards: [
        {
          type: 'tarotCard',
          card: { id: 'tp1', consumableType: 'tarotCard', tarotType: 'theFool' } as any,
          price: 0,
        },
      ],
    }
    game.shopState.packsForSale = [tarotPack]

    const afterOpen = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: 'pack-2' })
    // Normal pack price should be deducted (price comes from pack definition, priceMultiplier = 1)
    expect(afterOpen.money).toBeLessThan(10)
  })
})
