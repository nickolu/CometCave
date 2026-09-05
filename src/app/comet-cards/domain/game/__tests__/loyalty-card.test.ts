import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Loyalty Card joker', () => {
  function setupGame(): GameState {
    return inGameplay(startRunWithJokers([jokers.loyaltyCard]))
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

  function firedX4(state: GameState): boolean {
    return state.gamePlayState.scoringEvents.some(
      e =>
        'source' in e &&
        e.source === 'Loyalty Card' &&
        'operator' in e &&
        e.operator === 'x' &&
        'value' in e &&
        e.value === 4
    )
  }

  it('does not apply X4 Mult on hands 1 through 5', () => {
    let state = setupGame()
    for (let i = 0; i < 5; i++) {
      state = playHand(state)
      expect(state.jokers.some(j => j.jokerId === 'loyaltyCard')).toBe(true)
      expect(firedX4(state)).toBe(false)
    }
  })

  it('applies X4 Mult on hand 6', () => {
    let state = setupGame()
    for (let i = 0; i < 6; i++) {
      state = playHand(state)
    }
    expect(firedX4(state)).toBe(true)
  })

  it('counter resets and X4 fires again on hand 12', () => {
    let state = setupGame()
    for (let i = 0; i < 12; i++) {
      state = playHand(state)
    }
    expect(firedX4(state)).toBe(true)
  })
})
