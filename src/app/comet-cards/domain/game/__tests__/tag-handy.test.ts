import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Handy tag', () => {
  it('gains $1 per hand played this run on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'handy', name: 'Handy' } as any]
    game.money = 5
    game.handsPlayed = 12

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(17) // 5 + 12
  })

  it('removes the Handy tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'handy', name: 'Handy' } as any]
    game.handsPlayed = 5

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'handy')).toBeUndefined()
  })
})
