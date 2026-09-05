import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Square Joker', () => {
  function playHand(state: GameState, playedCardIds: string[]): GameState {
    return reduceGame(
      {
        ...state,
        gamePlayState: {
          ...state.gamePlayState,
          scoringEvents: [],
          playedCardIds,
          selectedHand: ['pair', []],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('increases counter by 4 when exactly 4 cards are played', () => {
    const started = inGameplay(startRunWithJokers([jokers.squareJoker]))

    const after = playHand(started, ['c1', 'c2', 'c3', 'c4'])
    const sj = after.jokers.find(j => j.jokerId === 'squareJoker')
    expect(sj?.counter).toBe(4)
  })

  it('does not increase counter when != 4 cards are played', () => {
    const started = inGameplay(startRunWithJokers([jokers.squareJoker]))

    const afterThree = playHand(started, ['c1', 'c2', 'c3'])
    expect(afterThree.jokers.find(j => j.jokerId === 'squareJoker')?.counter).toBe(0)

    // Four cards from the same state do move it, so the 0 above is the hand
    // being ignored rather than the joker doing nothing at all.
    const afterFour = playHand(afterThree, ['c1', 'c2', 'c3', 'c4'])
    expect(afterFour.jokers.find(j => j.jokerId === 'squareJoker')?.counter).toBe(4)
  })

  it('applies accumulated chips bonus on the hand where 4 cards are played', () => {
    const started = inGameplay(startRunWithJokers([jokers.squareJoker]))

    // First 4-card hand: counter goes from 0 to 4, bonus of 4 is applied
    const after1 = playHand(started, ['c1', 'c2', 'c3', 'c4'])
    expect(after1.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Square Joker' && 'value' in e && e.value === 4
    )).toBe(true)

    // Second 4-card hand: counter goes to 8, bonus of 8 is applied
    const after2 = playHand(after1, ['c1', 'c2', 'c3', 'c4'])
    const sj2 = after2.jokers.find(j => j.jokerId === 'squareJoker')
    expect(sj2?.counter).toBe(8)
    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Square Joker' && 'value' in e && e.value === 8
    )).toBe(true)
  })
})
