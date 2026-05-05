import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Ethereal tag', () => {
  it('adds a Spectral Pack to packsForSale on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'ethereal' } as any]
    const initialPacks = game.shopState.packsForSale.length

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.shopState.packsForSale.length).toBeGreaterThan(initialPacks)
  })

  it('removes the Ethereal tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'ethereal' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'ethereal')).toBeUndefined()
  })
})
