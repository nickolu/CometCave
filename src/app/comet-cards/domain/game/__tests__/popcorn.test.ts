import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Popcorn joker', () => {
  function setupGame(): GameState {
    return inGameplay(startRunWithJokers([jokers.popcorn]))
  }

  function playHand(state: GameState): GameState {
    return reduceGame(
      {
        ...state,
        gamePlayState: {
          ...state.gamePlayState,
          selectedHand: ['pair', []],
          score: { chips: 0, mult: 1 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('gives +20 Mult on first hand (counter initializes to 20)', () => {
    const after = playHand(setupGame())
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Popcorn' && 'value' in e && e.value === 20
    )).toBe(true)
  })

  it('decreases counter by 4 on ROUND_END', () => {
    // First fire HAND_SCORING_FINALIZE to initialize counter to 20
    const afterHand = playHand(setupGame())
    const popcornBefore = afterHand.jokers.find(j => j.jokerId === 'popcorn')
    expect(popcornBefore?.counter).toBe(20)

    const after = reduceGame(afterHand, { type: 'ROUND_END' })
    const popcornAfter = after.jokers.find(j => j.jokerId === 'popcorn')
    expect(popcornAfter?.counter).toBe(16)
  })

  it('self-destructs when counter reaches 0', () => {
    // Play 5 rounds to deplete from 20 to 0 (20 / 4 = 5 rounds)
    // First trigger HAND_SCORING_FINALIZE to initialize counter
    let state = playHand(setupGame())

    for (let i = 0; i < 5; i++) {
      state = reduceGame(state, { type: 'ROUND_END' })
    }

    const popcornInstance = state.jokers.find(j => j.jokerId === 'popcorn')
    expect(popcornInstance).toBeUndefined()
  })
})
