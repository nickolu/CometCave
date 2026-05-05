import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Garbage tag', () => {
  it('gains $1 per remaining discard on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'garbage', name: 'Garbage' } as any]
    game.money = 5
    game.gamePlayState.remainingDiscards = 4

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(9) // 5 + 4
  })

  it('removes the Garbage tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'garbage', name: 'Garbage' } as any]
    game.gamePlayState.remainingDiscards = 2

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'garbage')).toBeUndefined()
  })
})
