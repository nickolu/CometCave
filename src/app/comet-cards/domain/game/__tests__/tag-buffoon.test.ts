import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Buffoon tag', () => {
  it('immediately opens a Mega Buffoon Pack on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'buffoon' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.shopState.openPackState).not.toBeNull()
    expect(after.shopState.openPackState?.rarity).toBe('mega')
    expect(after.gamePhase).toBe('packOpening')
  })

  it('removes the Buffoon tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'buffoon' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'buffoon')).toBeUndefined()
  })
})
