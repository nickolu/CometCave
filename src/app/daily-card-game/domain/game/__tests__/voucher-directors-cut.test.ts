import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe("Director's Cut voucher", () => {
  it('enables 1 boss blind reroll per ante at $10 per roll', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.staticRules.bossBlindRerolls).toBe(0)
    expect(game.staticRules.bossBlindRerollCost).toBe(0)
    game.shopState.voucher = 'directorsCut'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'directorsCut' })
    expect(after.staticRules.bossBlindRerolls).toBe(1)
    expect(after.staticRules.bossBlindRerollCost).toBe(10)
  })
})
