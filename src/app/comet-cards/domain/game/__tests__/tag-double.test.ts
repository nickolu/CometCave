import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Double tag', () => {
  it('copies the first non-Double tag on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [
      { id: 'tag-double', tagType: 'double' } as any,
      { id: 'tag-juggle', tagType: 'juggle' } as any,
    ]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    // Double copies juggle at priority 0, then juggle fires at priority 1
    // and removes the original. The copy remains.
    const juggleTags = after.tags.filter(t => t.tagType === 'juggle')
    expect(juggleTags.length).toBeGreaterThanOrEqual(1)
    // Verify the copy has a different ID than the original
    expect(after.tags.find(t => t.id !== 'tag-juggle' && t.tagType === 'juggle')).toBeDefined()
  })

  it('removes the Double tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [
      { id: 'tag-double', tagType: 'double' } as any,
      { id: 'tag-economy', tagType: 'economy' } as any,
    ]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'double')).toBeUndefined()
  })

  it('does nothing if no other tags exist', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-double', tagType: 'double' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'double')).toBeUndefined()
    expect(after.tags.length).toBe(0)
  })
})
