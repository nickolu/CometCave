import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Voucher tag', () => {
  it('adds an extra voucher slot on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'voucher' } as any]
    const initialVouchers = game.shopState.maxVouchersForSale

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.shopState.maxVouchersForSale).toBe(initialVouchers + 1)
  })

  it('removes the Voucher tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'voucher' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'voucher')).toBeUndefined()
  })
})
