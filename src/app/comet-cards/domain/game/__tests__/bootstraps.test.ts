import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Bootstraps joker', () => {
  function playHandWithMoney(money: number): GameState {
    const started = inGameplay(startRunWithJokers([jokers.bootstrapsJoker]))
    return reduceGame({ ...started, money }, { type: 'HAND_SCORING_FINALIZE' })
  }

  it('adds +2 Mult per $5 on HAND_SCORING_FINALIZE', () => {
    const afterScore = playHandWithMoney(25)

    // $25 / $5 = 5, * 2 = +10 Mult
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bootstraps' && e.value === 10
    )).toBe(true)
  })

  it('adds 0 Mult when money is less than $5', () => {
    const afterScore = playHandWithMoney(3)

    expect(afterScore.jokers.some(j => j.jokerId === 'bootstrapsJoker')).toBe(true)
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bootstraps'
    )).toBe(false)
  })
})
