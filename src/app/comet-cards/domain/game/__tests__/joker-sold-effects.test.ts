import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('comet-cards joker sold effects', () => {
  it('Four Fingers resets staticRules back to 5 when sold and no other Four Fingers remains', () => {
    const started = startRunWithJokers([jokers.fourFingersJoker])

    // Ensure the Four Fingers static rule is active.
    expect(started.staticRules.numberOfCardsRequiredForFlushAndStraight).toBe(4)

    const fourFingersInstance = started.jokers.find(j => j.jokerId === jokers.fourFingersJoker.id)
    expect(fourFingersInstance).toBeTruthy()

    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: fourFingersInstance!.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })

    expect(afterSale.jokers.some(j => j.jokerId === jokers.fourFingersJoker.id)).toBe(false)
    expect(afterSale.staticRules.numberOfCardsRequiredForFlushAndStraight).toBe(5)
  })

  it('Four Fingers does not reset staticRules if another Four Fingers remains after selling one', () => {
    const started = startRunWithJokers([jokers.fourFingersJoker, jokers.fourFingersJoker])

    expect(started.staticRules.numberOfCardsRequiredForFlushAndStraight).toBe(4)

    const allFourFingers = started.jokers.filter(j => j.jokerId === jokers.fourFingersJoker.id)
    expect(allFourFingers.length).toBe(2)

    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: allFourFingers[0].id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })

    expect(afterSale.jokers.filter(j => j.jokerId === jokers.fourFingersJoker.id)).toHaveLength(1)
    expect(afterSale.staticRules.numberOfCardsRequiredForFlushAndStraight).toBe(4)
  })
})
