import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Bull joker', () => {
  function playHandWithMoney(money: number): GameState {
    const started = inGameplay(startRunWithJokers([jokers.bullJoker]))
    return reduceGame({ ...started, money }, { type: 'HAND_SCORING_FINALIZE' })
  }

  it('adds +2 Chips per $1 on HAND_SCORING_FINALIZE', () => {
    const afterScore = playHandWithMoney(25)

    // Score is reset after HAND_SCORING_FINALIZE; verify via scoringEvents
    expect(
      afterScore.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Bull' && e.value === 50
      )
    ).toBe(true)
  })

  it('adds 0 Chips when money is 0', () => {
    const afterScore = playHandWithMoney(0)

    expect(afterScore.jokers.some(j => j.jokerId === 'bullJoker')).toBe(true)
    expect(afterScore.gamePlayState.score.chips).toBe(0)
    expect(
      afterScore.gamePlayState.scoringEvents.some(e => 'source' in e && e.source === 'Bull')
    ).toBe(false)
  })
})
