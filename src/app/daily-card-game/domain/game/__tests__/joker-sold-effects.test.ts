import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('daily-card-game joker sold effects', () => {
  it('Four Fingers resets staticRules back to 5 when sold and no other Four Fingers remains', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fourFingersJoker)]
    game.staticRules.numberOfCardsRequiredForFlushAndStraight = 5

    // Ensure the Four Fingers static rule is active.
    const started = reduceGame(game, { type: 'GAME_START' })
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
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      initializeJoker(jokers.fourFingersJoker),
      initializeJoker(jokers.fourFingersJoker),
    ]
    game.staticRules.numberOfCardsRequiredForFlushAndStraight = 5

    const started = reduceGame(game, { type: 'GAME_START' })
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
