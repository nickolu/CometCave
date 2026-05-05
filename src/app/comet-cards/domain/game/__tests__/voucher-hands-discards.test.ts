import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Hands and Discards vouchers', () => {
  it('Grabber adds +1 maxHands', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxHands = 4
    game.shopState.voucher = 'grabber'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'grabber' })
    expect(after.maxHands).toBe(5)
  })

  it('Nacho Tong adds +1 maxHands', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxHands = 5
    game.shopState.voucher = 'nachoTong'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'nachoTong' })
    expect(after.maxHands).toBe(6)
  })

  it('Wasteful adds +1 maxDiscards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxDiscards = 3
    game.shopState.voucher = 'wasteful'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'wasteful' })
    expect(after.maxDiscards).toBe(4)
  })

  it('Recyclomancy adds +1 maxDiscards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxDiscards = 4
    game.shopState.voucher = 'recyclomancy'
    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'recyclomancy' })
    expect(after.maxDiscards).toBe(5)
  })
})
