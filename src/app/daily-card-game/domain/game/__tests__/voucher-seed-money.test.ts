import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Seed Money and Money Tree vouchers', () => {
  it('Seed Money raises maxInterest to 10', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxInterest = 5
    game.shopState.voucher = 'seedMoney'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'seedMoney' })
    expect(after.maxInterest).toBe(10)
  })

  it('Money Tree raises maxInterest to 20', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxInterest = 10
    game.shopState.voucher = 'moneyTree'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'moneyTree' })
    expect(after.maxInterest).toBe(20)
  })
})
