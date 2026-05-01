import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Chaos the Clown joker', () => {
  it('adds 1 freeReroll when the shop opens', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.chaosTheClown, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    expect(started.shopState.freeRerolls).toBe(0)

    const afterShopOpen = reduceGame(started, { type: 'SHOP_OPEN' })
    expect(afterShopOpen.shopState.freeRerolls).toBe(1)
  })

  it('allows one free reroll before charging money', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.chaosTheClown, game)]
    game.money = 10

    const started = reduceGame(game, { type: 'GAME_START' })
    const afterShopOpen = reduceGame(started, { type: 'SHOP_OPEN' })

    expect(afterShopOpen.shopState.freeRerolls).toBe(1)
    const moneyBeforeReroll = afterShopOpen.money

    // First reroll should be free
    const afterFreeReroll = reduceGame(afterShopOpen, { type: 'SHOP_REROLL' })
    expect(afterFreeReroll.money).toBe(moneyBeforeReroll)
    expect(afterFreeReroll.shopState.freeRerolls).toBe(0)

    // Second reroll should cost money
    const moneyAfterFreeReroll = afterFreeReroll.money
    const afterPaidReroll = reduceGame(afterFreeReroll, { type: 'SHOP_REROLL' })
    expect(afterPaidReroll.money).toBeLessThan(moneyAfterFreeReroll)
  })

  it('does not grant a free reroll without the joker', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.money = 10

    const started = reduceGame(game, { type: 'GAME_START' })
    const afterShopOpen = reduceGame(started, { type: 'SHOP_OPEN' })

    expect(afterShopOpen.shopState.freeRerolls).toBe(0)
  })
})
