import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Hiker joker', () => {
  function createGameWithHiker(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hiker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  function getFirstCardId(game: GameState): string {
    return Object.keys(game.cards)[0]
  }

  it('scored card permanently gains +5 bonusChips', () => {
    const game = createGameWithHiker()
    const cardId = getFirstCardId(game)
    const initialBonusChips = game.cards[cardId].bonusChips

    const withScoring: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        cardsToScore: [game.cards[cardId]],
      },
    }

    const afterScore = reduceGame(withScoring, { type: 'CARD_SCORED' })

    expect(afterScore.cards[cardId].bonusChips).toBe(initialBonusChips + 5)
  })

  it('bonus accumulates when card is scored twice', () => {
    const game = createGameWithHiker()
    const cardId = getFirstCardId(game)
    const initialBonusChips = game.cards[cardId].bonusChips

    const withScoring1: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        cardsToScore: [game.cards[cardId]],
      },
    }

    const afterScore1 = reduceGame(withScoring1, { type: 'CARD_SCORED' })

    const withScoring2: GameState = {
      ...afterScore1,
      gamePlayState: {
        ...afterScore1.gamePlayState,
        cardsToScore: [afterScore1.cards[cardId]],
      },
    }

    const afterScore2 = reduceGame(withScoring2, { type: 'CARD_SCORED' })

    expect(afterScore2.cards[cardId].bonusChips).toBe(initialBonusChips + 10)
  })
})
