import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Top-up tag', () => {
  it('adds up to 2 common jokers on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'topUp', name: 'Top-up' } as any]
    game.jokers = []
    game.maxJokers = 5

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.jokers.length).toBe(2)
  })

  it('respects max joker slots', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'topUp', name: 'Top-up' } as any]
    game.jokers = Array(4).fill({ jokerId: 'dummy' }) as any
    game.maxJokers = 5

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.jokers.length).toBe(5) // only 1 added (4 + 1 = 5 max)
  })

  it('removes the Top-up tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'topUp', name: 'Top-up' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'topUp')).toBeUndefined()
  })
})
