import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Investment tag', () => {
  it('grants $25 on SHOP_OPEN after boss blind is defeated', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'investment', name: 'Investment' } as any]
    game.money = 10
    // Simulate boss blind completed: roundIndex advanced to 1, prev round boss blind completed
    game.roundIndex = 1
    game.rounds[0].bossBlind.status = 'completed'

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(35) // 10 + 25
  })

  it('does not grant $25 if boss blind not yet completed', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'investment', name: 'Investment' } as any]
    game.money = 10
    // Still on round 0, no boss blind completed yet
    game.roundIndex = 0

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.money).toBe(10) // no change
  })

  it('removes the Investment tag after triggering', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'investment', name: 'Investment' } as any]
    game.roundIndex = 1
    game.rounds[0].bossBlind.status = 'completed'

    const after = reduceGame(game, { type: 'SHOP_OPEN' })
    expect(after.tags.find(t => t.tagType === 'investment')).toBeUndefined()
  })
})
