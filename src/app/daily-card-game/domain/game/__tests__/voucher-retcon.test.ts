import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Retcon voucher', () => {
  it('enables unlimited boss blind rerolls at $10 per roll', () => {
    const game: GameState = structuredClone(defaultGameState)
    // Simulate Director's Cut already purchased
    game.staticRules.bossBlindRerolls = 1
    game.staticRules.bossBlindRerollCost = 10
    game.shopState.voucher = 'retcon'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'retcon' })
    expect(after.staticRules.bossBlindRerolls).toBe(Infinity)
    expect(after.staticRules.bossBlindRerollCost).toBe(10)
  })
})
