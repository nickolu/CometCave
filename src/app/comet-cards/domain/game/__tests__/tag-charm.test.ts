import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Charm tag', () => {
  it('immediately opens a Mega Arcana Pack on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'charm' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.shopState.openPackState).not.toBeNull()
    expect(after.shopState.openPackState?.rarity).toBe('mega')
    expect(after.gamePhase).toBe('packOpening')
  })

  it('removes the Charm tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'charm' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'charm')).toBeUndefined()
  })

  it('deals cards to the hand for tarot card targeting', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'charm' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.gamePlayState.handIds.length).toBeGreaterThan(0)
  })
})
