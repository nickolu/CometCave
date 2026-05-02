import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Meteor tag', () => {
  it('adds a Mega Celestial Pack to packsForSale on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'meteor' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const megaPacks = after.shopState.packsForSale.filter(p => p.rarity === 'mega')
    expect(megaPacks.length).toBeGreaterThanOrEqual(1)
  })

  it('removes the Meteor tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'meteor' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'meteor')).toBeUndefined()
  })
})
