import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Planet Merchant voucher', () => {
  it('doubles celestialMultiplier so planet cards appear 2x more frequently', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.shopState.celestialMultiplier).toBe(1)
    game.shopState.voucher = 'planetMerchant'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'planetMerchant' })
    expect(after.shopState.celestialMultiplier).toBe(2)
  })
})
