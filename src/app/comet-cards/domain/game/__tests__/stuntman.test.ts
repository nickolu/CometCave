import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Stuntman joker', () => {
  it('reduces hand size by 2 when acquired', () => {
    const started = startRunWithJokers([jokers.stuntmanJoker])
    expect(started.handSizeModifier).toBe(-2)
  })

  it('adds +250 Chips on HAND_SCORING_FINALIZE', () => {
    const started = inGameplay(startRunWithJokers([jokers.stuntmanJoker]))
    const afterScore = reduceGame(started, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Stuntman' && e.value === 250
    )).toBe(true)
  })

  it('reverts hand size when sold', () => {
    const started = startRunWithJokers([jokers.stuntmanJoker])
    expect(started.handSizeModifier).toBe(-2)
    const instance = started.jokers.find(j => j.jokerId === 'stuntmanJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.handSizeModifier).toBe(0)
  })
})
