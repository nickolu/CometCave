import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Polychrome tag', () => {
  it('adds a free polychrome joker to guaranteed shop items on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'polychrome', name: 'Polychrome' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const jokerItems = after.shopState.cardsForSale.filter(
      item => item.type === 'jokerCard' && item.price === 0
    )
    expect(jokerItems.length).toBeGreaterThanOrEqual(1)
    // Check that the free joker has polychrome edition
    const freeJoker = jokerItems[0]
    expect((freeJoker.card as any).edition).toBe('polychrome')
  })

  it('removes the Polychrome tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'polychrome', name: 'Polychrome' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'polychrome')).toBeUndefined()
  })
})
