import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Campfire joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    return { ...game, ...overrides }
  }

  it('increases counter by 1 when a joker is sold via JOKER_SOLD', () => {
    const game = setupGame()
    const campfireInstance = initializeJoker(jokers.campfire, game)
    const otherJoker = initializeJoker(jokers.jokerJoker, game)
    game.jokers = [campfireInstance, otherJoker]

    // Select the other joker to sell it
    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: otherJoker.id },
    }

    const after = reduceGame(selected, { type: 'JOKER_SOLD' })

    const cf = after.jokers.find(j => j.jokerId === 'campfire')
    expect(cf).toBeTruthy()
    // counter starts at 0, lazy init sets it to 4, then +1 = 5
    expect(cf!.counter).toBe(5)
  })

  it('applies X Mult on HAND_SCORING_FINALIZE when counter > 4', () => {
    const game = setupGame()
    const campfireInstance = initializeJoker(jokers.campfire, game)
    // counter = 8 means X2 Mult (8 / 4 = 2)
    campfireInstance.counter = 8
    game.jokers = [campfireInstance]
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

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Campfire' && 'operator' in e && e.operator === 'x' && 'value' in e && e.value === 2
    )).toBe(true)
  })

  it('does not apply Mult on HAND_SCORING_FINALIZE when counter is exactly 4 (X1.0)', () => {
    const game = setupGame()
    const campfireInstance = initializeJoker(jokers.campfire, game)
    campfireInstance.counter = 4
    game.jokers = [campfireInstance]
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

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Campfire'
    )).toBe(false)
  })

  it('resets counter to 4 on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    const campfireInstance = initializeJoker(jokers.campfire, game)
    // Simulate having sold 3 cards: lazy init 4 + 3 = 7
    campfireInstance.counter = 7
    game.jokers = [campfireInstance]

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    const cf = after.jokers.find(j => j.jokerId === 'campfire')
    expect(cf!.counter).toBe(4)
  })
})
