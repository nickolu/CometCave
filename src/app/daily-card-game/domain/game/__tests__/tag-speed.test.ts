import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Speed tag', () => {
  it('gives at least $5 even with no skipped blinds (counts the skip that earned the tag)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'speed' } as any]
    const initialMoney = game.money

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(initialMoney + 5)
  })

  it('gives $5 per skipped blind', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'speed' } as any]
    game.rounds[0].smallBlind.status = 'skipped'
    game.rounds[0].bigBlind.status = 'skipped'
    const initialMoney = game.money

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(initialMoney + 10) // 2 skipped × $5
  })

  it('removes the Speed tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'speed' } as any]

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'speed')).toBeUndefined()
  })
})
