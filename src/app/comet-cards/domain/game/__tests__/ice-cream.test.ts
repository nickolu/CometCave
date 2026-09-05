import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Ice Cream joker', () => {
  function setupGame(): GameState {
    return inGameplay(startRunWithJokers([jokers.iceCream]))
  }

  function playHand(state: GameState): GameState {
    return reduceGame(
      {
        ...state,
        gamePlayState: {
          ...state.gamePlayState,
          scoringEvents: [],
          selectedHand: ['pair', []],
          score: { chips: 0, mult: 1 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('gives +100 Chips on first hand (counter initializes to 100)', () => {
    const after = playHand(setupGame())
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ice Cream' && 'value' in e && e.value === 100
    )).toBe(true)
  })

  it('gives +95 Chips on second hand (counter decremented to 95 after first)', () => {
    const after2 = playHand(playHand(setupGame()))

    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ice Cream' && 'value' in e && e.value === 95
    )).toBe(true)
  })

  it('self-destructs when counter reaches 0', () => {
    // Play 20 hands to deplete from 100 to 0 (100 / 5 = 20 hands)
    let state = setupGame()
    for (let i = 0; i < 20; i++) {
      state = playHand(state)
    }

    const iceCreamInstance = state.jokers.find(j => j.jokerId === 'iceCream')
    expect(iceCreamInstance).toBeUndefined()
  })
})
