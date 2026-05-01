import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Madness joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    return { ...game, ...overrides }
  }

  it('gains X0.5 Mult on SMALL_BLIND_SELECTED (counter goes from 2 to 3)', () => {
    const game = setupGame()
    const madness = initializeJoker(jokers.madness, game)
    madness.counter = 2
    game.jokers = [madness]

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    const madnessAfter = after.jokers.find(j => j.jokerId === 'madness')
    expect(madnessAfter?.counter).toBe(3)
  })

  it('gains X0.5 Mult on BIG_BLIND_SELECTED (counter goes from 2 to 3)', () => {
    const game = setupGame()
    const madness = initializeJoker(jokers.madness, game)
    madness.counter = 2
    game.jokers = [madness]

    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })

    const madnessAfter = after.jokers.find(j => j.jokerId === 'madness')
    expect(madnessAfter?.counter).toBe(3)
  })

  it('destroys a random other joker (not itself) on blind selection', () => {
    const game = setupGame()
    const madness = initializeJoker(jokers.madness, game)
    const otherJoker = initializeJoker(jokers.jokerJoker, game)
    madness.counter = 2
    game.jokers = [madness, otherJoker]

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    // Madness should survive, the other joker should be destroyed
    expect(after.jokers.length).toBe(1)
    expect(after.jokers[0].jokerId).toBe('madness')
  })

  it('does not destroy itself when it is the only joker', () => {
    const game = setupGame()
    const madness = initializeJoker(jokers.madness, game)
    madness.counter = 2
    game.jokers = [madness]

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    expect(after.jokers.length).toBe(1)
    expect(after.jokers[0].jokerId).toBe('madness')
    // Counter should still increment
    const madnessAfter = after.jokers.find(j => j.jokerId === 'madness')
    expect(madnessAfter?.counter).toBe(3)
  })

  it('applies X Mult on HAND_SCORING_FINALIZE (counter/2 as multiplier)', () => {
    const game = setupGame()
    const madness = initializeJoker(jokers.madness, game)
    madness.counter = 3
    game.jokers = [madness]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const withHand: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }

    const after = reduceGame(withHand, { type: 'HAND_SCORING_FINALIZE' })

    // counter=3 → X1.5
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Madness' && 'operator' in e && e.operator === 'x' && e.value === 1.5
    )).toBe(true)
  })

  it('lazy inits counter to 2 (X1.0) on HAND_SCORING_FINALIZE when counter is 0', () => {
    const game = setupGame()
    const madness = initializeJoker(jokers.madness, game)
    madness.counter = 0
    game.jokers = [madness]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const withHand: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }

    const after = reduceGame(withHand, { type: 'HAND_SCORING_FINALIZE' })

    // counter=0 → lazy init to 2 → X1.0
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Madness' && 'operator' in e && e.operator === 'x' && e.value === 1.0
    )).toBe(true)
  })
})
