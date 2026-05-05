import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Tarot Merchant and Tarot Tycoon vouchers', () => {
  it('Tarot Merchant doubles tarotCard multiplier', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.shopState.tarotCard.multiplier).toBe(1)
    game.shopState.voucher = 'tarotMerchant'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'tarotMerchant' })
    expect(after.shopState.tarotCard.multiplier).toBe(2)
  })

  it('Tarot Tycoon doubles again for cumulative 4x', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.shopState.tarotCard.multiplier = 2
    game.shopState.voucher = 'tarotTycoon'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'tarotTycoon' })
    expect(after.shopState.tarotCard.multiplier).toBe(4)
  })
})
