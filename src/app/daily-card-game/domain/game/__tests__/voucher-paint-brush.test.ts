import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Paint Brush and Palette vouchers', () => {
  it('Paint Brush adds +1 hand size on purchase', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.handSizeModifier = 0
    game.shopState.voucher = 'paintBrush'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'paintBrush' })
    expect(after.handSizeModifier).toBe(1)
  })

  it('Palette adds +1 hand size on purchase', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.handSizeModifier = 1
    game.shopState.voucher = 'palette'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'palette' })
    expect(after.handSizeModifier).toBe(2)
  })
})
