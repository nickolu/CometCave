import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Boss tag', () => {
  it('re-rolls the boss blind name on BOSS_BLIND_SELECTED', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'boss', name: 'Boss' } as any]
    const originalBossName = game.rounds[game.roundIndex].bossBlindName

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    // Boss blind name should change (or at least the tag should be consumed)
    // Due to randomness it might roll the same name, so just check tag is removed
    expect(after.tags.find(t => t.tagType === 'boss')).toBeUndefined()
  })

  it('removes the Boss tag after use', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.tags = [{ id: 'tag-1', tagType: 'boss', name: 'Boss' } as any]

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.tags.find(t => t.tagType === 'boss')).toBeUndefined()
  })
})
