import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The Needle boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Needle'
    return { ...game, ...overrides }
  }

  it('sets maxHands to 1 when boss blind is selected', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.maxHands).toBe(1)
  })

  it('sets remainingHands to 1 when boss blind is selected', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.gamePlayState.remainingHands).toBe(1)
  })
})
