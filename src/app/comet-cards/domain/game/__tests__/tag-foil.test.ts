import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Foil tag', () => {
  it('adds a free foil joker to guaranteed shop items on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'foil', name: 'Foil' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const jokerItems = after.shopState.cardsForSale.filter(
      item => item.type === 'jokerCard' && item.price === 0
    )
    expect(jokerItems.length).toBeGreaterThanOrEqual(1)
    expect((jokerItems[0].card as any).edition).toBe('foil')
  })

  it('removes the Foil tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'foil', name: 'Foil' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'foil')).toBeUndefined()
  })
})
