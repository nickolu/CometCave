import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRun, startRunWithJokers } from './helpers/start-run'

describe('Drunkard joker', () => {
  it('adds +1 discard when acquired', () => {
    const withoutJoker = startRun()
    const started = startRunWithJokers([jokers.drunkardJoker])
    expect(started.maxDiscards).toBe(withoutJoker.maxDiscards + 1)
  })

  it('reverts when sold', () => {
    const withoutJoker = startRun()
    const started = startRunWithJokers([jokers.drunkardJoker])
    expect(started.maxDiscards).toBe(withoutJoker.maxDiscards + 1)
    const instance = started.jokers.find(j => j.jokerId === 'drunkardJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.maxDiscards).toBe(withoutJoker.maxDiscards)
  })
})
