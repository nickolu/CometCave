import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Negative tag', () => {
  it('adds a free negative joker and +1 joker slot on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'negative', name: 'Negative' } as any]
    game.maxJokers = 5

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const jokerItems = after.shopState.cardsForSale.filter(
      item => item.type === 'jokerCard' && item.price === 0
    )
    expect(jokerItems.length).toBeGreaterThanOrEqual(1)
    expect((jokerItems[0].card as any).edition).toBe('negative')
    expect(after.maxJokers).toBe(6)
  })

  it('removes the Negative tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'negative', name: 'Negative' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'negative')).toBeUndefined()
  })
})
