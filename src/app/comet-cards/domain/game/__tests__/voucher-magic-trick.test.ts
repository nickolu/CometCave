import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Magic Trick voucher', () => {
  it('enables playing cards in the shop by setting multiplier to 1', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.shopState.playingCard.multiplier).toBe(0)
    game.shopState.voucher = 'magicTrick'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'magicTrick' })
    expect(after.shopState.playingCard.multiplier).toBe(1)
  })
})
