import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import type { BuyableCard } from '@/app/daily-card-game/domain/shop/types'

describe('Credit Card joker', () => {
  it('sets minimumMoney to -20 when Credit Card is purchased (JOKER_ADDED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = []

    const creditCardState = initializeJoker(jokers.creditCard, game)
    const buyable: BuyableCard = {
      type: 'jokerCard',
      card: creditCardState,
      price: jokers.creditCard.price,
    }

    game.money = 999
    game.shopState.cardsForSale = [buyable]
    game.shopState.selectedCardId = creditCardState.id

    const afterPurchase = reduceGame(game, { type: 'SHOP_BUY_CARD' })

    expect(afterPurchase.jokers.some(j => j.jokerId === 'creditCard')).toBe(true)
    expect(afterPurchase.minimumMoney).toBe(-20)
  })

  it('resets minimumMoney to 0 when Credit Card is removed (JOKER_REMOVED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    const creditCardInstance = initializeJoker(jokers.creditCard, game)
    game.jokers = [creditCardInstance]
    game.minimumMoney = -20

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: creditCardInstance.id },
    }

    const afterRemoval = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(afterRemoval.jokers.some(j => j.jokerId === 'creditCard')).toBe(false)
    expect(afterRemoval.minimumMoney).toBe(0)
  })

  it('does not reset minimumMoney when another Credit Card remains after removal', () => {
    const game: GameState = structuredClone(defaultGameState)
    const creditCard1 = initializeJoker(jokers.creditCard, game)
    const creditCard2 = initializeJoker(jokers.creditCard, game)
    game.jokers = [creditCard1, creditCard2]
    game.minimumMoney = -20

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: creditCard1.id },
    }

    const afterRemoval = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(afterRemoval.jokers.filter(j => j.jokerId === 'creditCard')).toHaveLength(1)
    expect(afterRemoval.minimumMoney).toBe(-20)
  })
})
