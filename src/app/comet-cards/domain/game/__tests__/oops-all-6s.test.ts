import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

describe('Oops! All 6s joker', () => {
  function buyOopsAll6s(game: GameState): GameState {
    const jokerState = initializeJoker(jokers.oopsAll6s, game)
    const buyable: BuyableCard = {
      type: 'jokerCard',
      card: jokerState,
      price: jokers.oopsAll6s.price,
    }
    const withShop: GameState = {
      ...game,
      money: 999,
      shopState: { ...game.shopState, cardsForSale: [buyable], selectedCardId: jokerState.id },
    }
    return reduceGame(withShop, { type: 'SHOP_BUY_CARD' })
  }

  it('doubles probabilityMultiplier when joker is added', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = []

    const after = buyOopsAll6s(game)

    expect(after.staticRules.probabilityMultiplier).toBe(2)
  })

  it('reverts probabilityMultiplier to 1 when joker is removed', () => {
    const game: GameState = structuredClone(defaultGameState)
    const jokerInstance = initializeJoker(jokers.oopsAll6s, game)
    game.jokers = [jokerInstance]
    game.staticRules = { ...game.staticRules, probabilityMultiplier: 2 }

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: jokerInstance.id },
    }

    const after = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(after.jokers.some(j => j.jokerId === 'oopsAll6s')).toBe(false)
    expect(after.staticRules.probabilityMultiplier).toBe(1)
  })

  it('stacks with multiple copies (each new purchase triggers all existing oopsAll6s jokers)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = []

    const afterFirst = buyOopsAll6s(game)
    expect(afterFirst.staticRules.probabilityMultiplier).toBe(2)

    // When a second oopsAll6s is bought, JOKER_ADDED fires for ALL jokers including
    // the first copy, so both copies double the multiplier: 2 * 2 = 4, then * 2 = 8
    const afterSecond = buyOopsAll6s(afterFirst)
    expect(afterSecond.staticRules.probabilityMultiplier).toBe(8)
  })

  it('multiplier cannot go below 1 after removal', () => {
    const game: GameState = structuredClone(defaultGameState)
    const jokerInstance = initializeJoker(jokers.oopsAll6s, game)
    game.jokers = [jokerInstance]
    // Simulate multiplier already at 1 (e.g. some external reset)
    game.staticRules = { ...game.staticRules, probabilityMultiplier: 1 }

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: jokerInstance.id },
    }

    const after = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(after.staticRules.probabilityMultiplier).toBeGreaterThanOrEqual(1)
  })
})
