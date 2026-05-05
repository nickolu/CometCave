import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('The Manacle boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Manacle'
    return { ...game, ...overrides }
  }

  it('reduces handSizeModifier by 1 on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    game.handSizeModifier = 0
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.handSizeModifier).toBe(-1)
  })

  it('stacks with existing handSizeModifier', () => {
    const game = setupGame()
    game.handSizeModifier = 2
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.handSizeModifier).toBe(1)
  })
})
