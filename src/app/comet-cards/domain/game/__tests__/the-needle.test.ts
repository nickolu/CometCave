import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

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

  it('restores maxHands to original value when boss blind is cleared', () => {
    const game = setupGame()
    const originalMaxHands = game.maxHands // default is 4
    const afterSelect = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(afterSelect.maxHands).toBe(1)
    const afterClear = reduceGame(afterSelect, { type: 'BLIND_REWARDS_END' })
    expect(afterClear.maxHands).toBe(originalMaxHands)
  })

  it('restores a non-default maxHands value when boss blind is cleared', () => {
    const game = setupGame()
    game.maxHands = 6 // simulate voucher or joker having increased maxHands
    const afterSelect = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(afterSelect.maxHands).toBe(1)
    const afterClear = reduceGame(afterSelect, { type: 'BLIND_REWARDS_END' })
    expect(afterClear.maxHands).toBe(6)
  })
})
