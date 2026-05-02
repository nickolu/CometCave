import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Rare tag', () => {
  it('adds a free rare joker to guaranteed shop items on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'rare', name: 'Rare' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const freeJokers = after.shopState.cardsForSale.filter(
      item => item.type === 'jokerCard' && item.price === 0
    )
    expect(freeJokers.length).toBeGreaterThanOrEqual(1)
  })

  it('removes the Rare tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'rare', name: 'Rare' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'rare')).toBeUndefined()
  })
})
