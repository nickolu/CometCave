import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Runner joker', () => {
  function playHand(state: GameState, hand: 'straight' | 'pair'): GameState {
    return reduceGame(
      {
        ...state,
        gamePlayState: {
          ...state.gamePlayState,
          scoringEvents: [],
          selectedHand: [hand, []],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('increases counter by 15 when a Straight is played', () => {
    const started = inGameplay(startRunWithJokers([jokers.runner]))
    const after = playHand(started, 'straight')
    const runnerInstance = after.jokers.find(j => j.jokerId === 'runner')
    expect(runnerInstance?.counter).toBe(15)
  })

  it('does not increase counter for non-Straight hands', () => {
    const started = inGameplay(startRunWithJokers([jokers.runner]))
    const afterPair = playHand(started, 'pair')
    expect(afterPair.jokers.find(j => j.jokerId === 'runner')?.counter).toBe(0)

    // A Straight from the same state does move it, so the 0 above is the hand
    // being ignored rather than the joker doing nothing at all.
    const afterStraight = playHand(afterPair, 'straight')
    expect(afterStraight.jokers.find(j => j.jokerId === 'runner')?.counter).toBe(15)
  })

  it('applies accumulated chips bonus on the hand where Straight is played', () => {
    const started = inGameplay(startRunWithJokers([jokers.runner]))

    // First straight: counter goes from 0 to 15, bonus of 15 is applied
    const after1 = playHand(started, 'straight')
    expect(after1.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Runner' && 'value' in e && e.value === 15
    )).toBe(true)

    // Second straight: counter goes to 30, bonus of 30 is applied
    const after2 = playHand(after1, 'straight')
    const runnerInstance2 = after2.jokers.find(j => j.jokerId === 'runner')
    expect(runnerInstance2?.counter).toBe(30)
    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Runner' && 'value' in e && e.value === 30
    )).toBe(true)
  })
})
