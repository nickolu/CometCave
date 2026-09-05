import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRun, startRunWithJokers } from './helpers/start-run'

describe('Chaos the Clown joker', () => {
  it('adds 1 freeReroll when the shop opens', () => {
    const started = startRunWithJokers([jokers.chaosTheClown])

    expect(started.shopState.freeRerolls).toBe(0)

    const afterShopOpen = reduceGame(started, { type: 'SHOP_OPEN' })
    expect(afterShopOpen.shopState.freeRerolls).toBe(1)
  })

  it('allows one free reroll before charging money', () => {
    const started = { ...startRunWithJokers([jokers.chaosTheClown]), money: 10 }
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
    const started = { ...startRun(), money: 10 }
    const afterShopOpen = reduceGame(started, { type: 'SHOP_OPEN' })

    expect(afterShopOpen.shopState.freeRerolls).toBe(0)
  })
})
