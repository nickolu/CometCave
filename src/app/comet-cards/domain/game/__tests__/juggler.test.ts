import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Juggler joker', () => {
  it('adds +1 hand size when acquired', () => {
    const started = startRunWithJokers([jokers.jugglerJoker])
    expect(started.handSizeModifier).toBe(1)
  })

  it('reverts when sold', () => {
    const started = startRunWithJokers([jokers.jugglerJoker])
    expect(started.handSizeModifier).toBe(1)
    const instance = started.jokers.find(j => j.jokerId === 'jugglerJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.handSizeModifier).toBe(0)
  })
})
