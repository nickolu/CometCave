import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { collectEffects } from '@/app/daily-card-game/domain/game/utils'

describe('D6 tag', () => {
  it('has effects registered in the tags definition', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'd6', name: 'D6' } as any]
    const effects = collectEffects(game)
    const shopOpenEffects = effects.filter(e => e.event.type === 'SHOP_OPEN')
    expect(shopOpenEffects.length).toBeGreaterThan(0)
  })

  it('grants free rerolls on SHOP_OPEN', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'd6', name: 'D6' } as any]
    game.shopState.freeRerolls = 0

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.shopState.freeRerolls).toBeGreaterThanOrEqual(100)
  })

  it('removes the D6 tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'd6', name: 'D6' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'd6')).toBeUndefined()
  })
})
