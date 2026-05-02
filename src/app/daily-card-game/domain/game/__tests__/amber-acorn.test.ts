import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Amber Acorn showdown boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'Amber Acorn'
    return { ...game, ...overrides }
  }

  it('flips all jokers face down on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    game.jokers = [
      { id: 'j1', jokerId: 'joker', isFaceUp: true } as any,
      { id: 'j2', jokerId: 'jolly', isFaceUp: true } as any,
      { id: 'j3', jokerId: 'zany', isFaceUp: true } as any,
    ]

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    for (const joker of after.jokers) {
      expect(joker.isFaceUp).toBe(false)
    }
  })

  it('shuffles joker order deterministically', () => {
    const game = setupGame()
    game.gameSeed = 'test-shuffle-seed'
    game.jokers = [
      { id: 'j1', jokerId: 'joker', isFaceUp: true } as any,
      { id: 'j2', jokerId: 'jolly', isFaceUp: true } as any,
      { id: 'j3', jokerId: 'zany', isFaceUp: true } as any,
    ]

    const after1 = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    // Run again with same seed - should produce same shuffle
    const game2 = setupGame()
    game2.gameSeed = 'test-shuffle-seed'
    game2.jokers = [
      { id: 'j1', jokerId: 'joker', isFaceUp: true } as any,
      { id: 'j2', jokerId: 'jolly', isFaceUp: true } as any,
      { id: 'j3', jokerId: 'zany', isFaceUp: true } as any,
    ]

    const after2 = reduceGame(game2, { type: 'BOSS_BLIND_SELECTED' })
    expect(after1.jokers.map(j => j.id)).toEqual(after2.jokers.map(j => j.id))
  })
})
