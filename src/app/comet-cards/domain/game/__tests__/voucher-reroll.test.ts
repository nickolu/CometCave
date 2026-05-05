import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Reroll cost vouchers', () => {
  it('Reroll Surplus reduces baseRerollPrice by 2', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.shopState.baseRerollPrice = 5
    game.shopState.voucher = 'rerollSurplus'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'rerollSurplus' })
    expect(after.shopState.baseRerollPrice).toBe(3)
  })

  it('Reroll Glut reduces baseRerollPrice by another 2', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.shopState.baseRerollPrice = 3
    game.shopState.voucher = 'rerollGlut'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'rerollGlut' })
    expect(after.shopState.baseRerollPrice).toBe(1)
  })

  it('does not go below 0', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.shopState.baseRerollPrice = 1
    game.shopState.voucher = 'rerollSurplus'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'rerollSurplus' })
    expect(after.shopState.baseRerollPrice).toBe(0)
  })
})
