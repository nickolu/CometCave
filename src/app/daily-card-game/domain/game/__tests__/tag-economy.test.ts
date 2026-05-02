import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Economy tag', () => {
  it('doubles money on SHOP_OPEN (max +$40)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'economy', name: 'Economy' } as any]
    game.money = 20

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(40) // 20 + 20
  })

  it('caps gain at $40', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'economy', name: 'Economy' } as any]
    game.money = 60

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(100) // 60 + 40 (capped)
  })

  it('removes the Economy tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'economy', name: 'Economy' } as any]
    game.money = 10

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'economy')).toBeUndefined()
  })
})
