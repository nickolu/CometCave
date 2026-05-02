import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Juggle tag', () => {
  it('adds +3 to handSizeModifier on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'juggle', name: 'Juggle' } as any]
    game.handSizeModifier = 0

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.handSizeModifier).toBe(3)
  })

  it('removes the Juggle tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'juggle', name: 'Juggle' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'juggle')).toBeUndefined()
  })
})
