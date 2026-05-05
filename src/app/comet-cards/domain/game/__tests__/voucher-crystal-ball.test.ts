import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Crystal Ball voucher', () => {
  it('adds +1 consumable slot', () => {
    const game: GameState = structuredClone(defaultGameState)
    const initialSlots = game.maxConsumables
    game.shopState.voucher = 'crystalBall'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'crystalBall' })
    expect(after.maxConsumables).toBe(initialSlots + 1)
  })
})
