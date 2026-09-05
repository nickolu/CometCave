import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Golden Joker', () => {
  it('earns $4 on ROUND_END', () => {
    const started = startRunWithJokers([jokers.goldenJokerJoker])
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 4)
  })
})
