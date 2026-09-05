import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRun, startRunWithJokers } from './helpers/start-run'

describe('Merry Andy joker', () => {
  it('adds +3 discards and -1 hand size when acquired', () => {
    const withoutJoker = startRun()
    const started = startRunWithJokers([jokers.merryAndyJoker])
    expect(started.maxDiscards).toBe(withoutJoker.maxDiscards + 3)
    expect(started.handSizeModifier).toBe(-1)
  })

  it('reverts when sold', () => {
    const withoutJoker = startRun()
    const started = startRunWithJokers([jokers.merryAndyJoker])
    expect(started.maxDiscards).toBe(withoutJoker.maxDiscards + 3)
    expect(started.handSizeModifier).toBe(-1)
    const instance = started.jokers.find(j => j.jokerId === 'merryAndyJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.maxDiscards).toBe(withoutJoker.maxDiscards)
    expect(afterSale.handSizeModifier).toBe(0)
  })
})
