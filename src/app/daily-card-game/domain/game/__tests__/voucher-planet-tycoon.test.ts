import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Planet Tycoon voucher', () => {
  it('doubles celestialMultiplier for cumulative 4x with Planet Merchant', () => {
    const game: GameState = structuredClone(defaultGameState)
    // Simulate Planet Merchant already purchased (celestialMultiplier = 2)
    game.shopState.celestialMultiplier = 2
    game.shopState.voucher = 'planetTycoon'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'planetTycoon' })
    expect(after.shopState.celestialMultiplier).toBe(4)
  })
})
