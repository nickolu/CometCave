import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Hieroglyph and Petroglyph vouchers', () => {
  it('Hieroglyph reduces maxHands by 1 on purchase', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxHands = 4
    game.shopState.voucher = 'hieroglyph'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'hieroglyph' })
    expect(after.maxHands).toBe(3)
  })

  it('Petroglyph reduces maxDiscards by 1 on purchase', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxDiscards = 3
    game.shopState.voucher = 'petroglyph'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'petroglyph' })
    expect(after.maxDiscards).toBe(2)
  })
})
