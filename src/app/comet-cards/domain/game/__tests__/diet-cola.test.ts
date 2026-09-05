import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Diet Cola joker', () => {
  it('creates a Double Tag when sold', () => {
    const started = startRunWithJokers([jokers.dietColaJoker])

    expect(started.tags.filter(t => t.tagType === 'double')).toHaveLength(0)

    const dcInstance = started.jokers.find(j => j.jokerId === 'dietColaJoker')!
    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: dcInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.jokers.some(j => j.jokerId === 'dietColaJoker')).toBe(false)
    expect(afterSale.tags.filter(t => t.tagType === 'double')).toHaveLength(1)
  })

  it('does not create a tag when another joker is sold', () => {
    const started = startRunWithJokers([jokers.dietColaJoker, jokers.jokerJoker])

    // Sell the basic Joker, not Diet Cola
    const basicJoker = started.jokers.find(j => j.jokerId === 'jokerJoker')!
    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: basicJoker.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    // Diet Cola should still be there, and no Double Tag created
    expect(afterSale.jokers.some(j => j.jokerId === 'dietColaJoker')).toBe(true)
    expect(afterSale.tags.filter(t => t.tagType === 'double')).toHaveLength(0)

    // ...and selling Diet Cola out of that same state does produce the tag,
    // so the empty result above is the sale being scoped, not a dead effect.
    const dcInstance = afterSale.jokers.find(j => j.jokerId === 'dietColaJoker')!
    const afterSellingDietCola = reduceGame(
      {
        ...afterSale,
        gamePlayState: { ...afterSale.gamePlayState, selectedJokerId: dcInstance.id },
      },
      { type: 'JOKER_SOLD' }
    )
    expect(afterSellingDietCola.tags.filter(t => t.tagType === 'double')).toHaveLength(1)
  })
})
