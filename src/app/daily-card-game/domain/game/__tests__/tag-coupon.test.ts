import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Coupon tag', () => {
  it('makes all initial shop cards free on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'coupon', name: 'Coupon' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    // All cards for sale should be $0
    for (const item of after.shopState.cardsForSale) {
      expect(item.price).toBe(0)
    }
  })

  it('removes the Coupon tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'coupon', name: 'Coupon' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'coupon')).toBeUndefined()
  })
})
