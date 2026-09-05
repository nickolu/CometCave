import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Delayed Gratification', () => {
  it('earns $2 per maxDiscards when no discards are used by end of round', () => {
    const started = {
      ...startRunWithJokers([jokers.delayedGratification]),
      maxDiscards: 3,
      discardsPlayed: 0,
    }
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(started.money + 6)
  })

  it('earns $0 when any discards were used', () => {
    const started = {
      ...startRunWithJokers([jokers.delayedGratification]),
      maxDiscards: 3,
      discardsPlayed: 1,
    }
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.jokers.some(j => j.jokerId === 'delayedGratification')).toBe(true)
    expect(afterRound.money).toBe(started.money)
  })
})
