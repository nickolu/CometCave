import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Blank and Antimatter vouchers', () => {
  it('Blank does nothing on purchase (no error)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.shopState.voucher = 'blank'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'blank' })
    expect(after).toBeDefined()
  })

  it('Antimatter adds +1 joker slot on purchase', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxJokers = 5
    game.shopState.voucher = 'antimatter'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'antimatter' })
    expect(after.maxJokers).toBe(6)
  })
})
