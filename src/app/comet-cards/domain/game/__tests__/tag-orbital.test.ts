import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Orbital tag', () => {
  it('upgrades a random poker hand by 3 levels on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'orbital', name: 'Orbital' } as any]

    // Record initial total levels
    const initialTotalLevel = Object.values(game.pokerHands).reduce((sum, h) => sum + h.level, 0)

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const afterTotalLevel = Object.values(after.pokerHands).reduce((sum, h) => sum + h.level, 0)

    expect(afterTotalLevel).toBe(initialTotalLevel + 3)
  })

  it('removes the Orbital tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'orbital', name: 'Orbital' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'orbital')).toBeUndefined()
  })
})
