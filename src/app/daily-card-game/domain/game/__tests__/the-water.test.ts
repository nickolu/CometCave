import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The Water boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Water'
    return { ...game, ...overrides }
  }

  it('sets remainingDiscards to 0 on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    game.gamePlayState.remainingDiscards = 3
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.gamePlayState.remainingDiscards).toBe(0)
  })
})
