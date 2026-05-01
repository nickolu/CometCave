import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Runner joker', () => {
  it('increases counter by 15 when a Straight is played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.runner, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['straight', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const runnerInstance = after.jokers.find(j => j.jokerId === 'runner')
    expect(runnerInstance?.counter).toBe(15)
  })

  it('does not increase counter for non-Straight hands', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.runner, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const runnerInstance = after.jokers.find(j => j.jokerId === 'runner')
    expect(runnerInstance?.counter).toBe(0)
  })

  it('applies accumulated chips bonus on the hand where Straight is played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.runner, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    // First straight: counter goes from 0 to 15, bonus of 15 is applied
    const hand1: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['straight', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after1 = reduceGame(hand1, { type: 'HAND_SCORING_FINALIZE' })
    expect(after1.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Runner' && 'value' in e && e.value === 15
    )).toBe(true)

    // Second straight: counter goes to 30, bonus of 30 is applied
    const runnerInstance = after1.jokers.find(j => j.jokerId === 'runner')!
    const hand2: GameState = {
      ...after1,
      gamePlayState: {
        ...after1.gamePlayState,
        scoringEvents: [],
        selectedHand: ['straight', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after2 = reduceGame(hand2, { type: 'HAND_SCORING_FINALIZE' })
    const runnerInstance2 = after2.jokers.find(j => j.jokerId === 'runner')
    expect(runnerInstance2?.counter).toBe(30)
    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Runner' && 'value' in e && e.value === 30
    )).toBe(true)
  })
})
