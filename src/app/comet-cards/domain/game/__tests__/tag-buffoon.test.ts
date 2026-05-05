import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Buffoon tag', () => {
  it('adds a Mega Buffoon Pack to packsForSale on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'buffoon' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    const megaPacks = after.shopState.packsForSale.filter(p => p.rarity === 'mega')
    expect(megaPacks.length).toBeGreaterThanOrEqual(1)
  })

  it('removes the Buffoon tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'buffoon' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'buffoon')).toBeUndefined()
  })
})
