import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Telescope voucher', () => {
  it('activates telescopeActive flag', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.staticRules.telescopeActive).toBe(false)
    game.shopState.voucher = 'telescope'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'telescope' })
    expect(after.staticRules.telescopeActive).toBe(true)
  })
})
