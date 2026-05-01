import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState, ScoringEvent } from '@/app/daily-card-game/domain/game/types'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('daily-card-game joker sold effects', () => {
  it('Four Fingers resets staticRules back to 5 when sold and no other Four Fingers remains', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fourFingersJoker, game)]
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
      initializeJoker(jokers.fourFingersJoker, defaultGameState),
      initializeJoker(jokers.fourFingersJoker, defaultGameState),
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

  it('selling the selected joker clears Verdant Leaf boss blind debuff for card scoring', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.roundIndex = 8
    game.rounds[8].bossBlindName = 'Verdant Leaf'
    game.rounds[8].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.jokers = [initializeJoker(jokers.jugglerJoker, game)]

    const jokerInstance = game.jokers[0]
    const scoringCard: PlayingCardState = {
      id: 'score-card',
      playingCardId: 'A_spades',
      bonusChips: 0,
      flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
      isFaceUp: true,
    }

    const scoringState = {
      ...game.gamePlayState,
      selectedJokerId: jokerInstance.id,
      cardsToScore: [scoringCard],
      selectedCardIds: [scoringCard.id],
      selectedHand: ['highCard', [scoringCard]] as ['highCard', PlayingCardState[]],
      handIds: [scoringCard.id],
      score: { chips: 0, mult: 0 },
      scoringEvents: [],
    }

    const selected = {
      ...game,
      gamePlayState: scoringState,
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.gamePlayState.selectedJokerId).toBeUndefined()
    expect(afterSale.jokers).toHaveLength(0)

    const afterScoring = reduceGame(afterSale, { type: 'CARD_SCORED' })

    expect(afterScoring.gamePlayState.score.chips).toBe(11)
    expect(
      afterScoring.gamePlayState.scoringEvents.some(
        (event): event is ScoringEvent =>
          'type' in event && event.type === 'chips' && event.value === 11
      )
    ).toBe(true)
  })
})
