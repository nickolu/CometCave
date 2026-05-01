import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Loyalty Card joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.loyaltyCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return reduceGame(game, { type: 'GAME_START' })
  }

  function playHand(state: GameState): GameState {
    return reduceGame(
      {
        ...state,
        gamePlayState: {
          ...state.gamePlayState,
          scoringEvents: [],
          score: { chips: 0, mult: 1 },
          selectedHand: ['pair', []],
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('does not apply X4 Mult on hands 1 through 5', () => {
    let state = setupGame()
    for (let i = 0; i < 5; i++) {
      state = playHand(state)
      expect(
        state.gamePlayState.scoringEvents.some(
          e => 'source' in e && e.source === 'Loyalty Card'
        )
      ).toBe(false)
    }
  })

  it('applies X4 Mult on hand 6', () => {
    let state = setupGame()
    for (let i = 0; i < 6; i++) {
      state = playHand(state)
    }
    expect(
      state.gamePlayState.scoringEvents.some(
        e =>
          'source' in e &&
          e.source === 'Loyalty Card' &&
          'operator' in e &&
          e.operator === 'x' &&
          'value' in e &&
          e.value === 4
      )
    ).toBe(true)
  })

  it('counter resets and X4 fires again on hand 12', () => {
    let state = setupGame()
    for (let i = 0; i < 12; i++) {
      state = playHand(state)
    }
    expect(
      state.gamePlayState.scoringEvents.some(
        e =>
          'source' in e &&
          e.source === 'Loyalty Card' &&
          'operator' in e &&
          e.operator === 'x' &&
          'value' in e &&
          e.value === 4
      )
    ).toBe(true)
  })
})
