import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('The Flint boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Flint'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('halves base chips and mult after HAND_SCORING_START for a Pair', () => {
    const game = setupGame()

    // Find two aces to form a Pair (baseChips=10, baseMult=2)
    const aceIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )
    const aceId1 = aceIds[0]!
    const aceId2 = aceIds[1]!

    const gameWithCards: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedCardIds: [aceId1, aceId2],
        handIds: [aceId1, aceId2],
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    // Pair: baseChips=10, baseMult=2 → halved: chips=5, mult=1
    expect(after.gamePlayState.score.chips).toBe(5)
    expect(after.gamePlayState.score.mult).toBe(1)
  })

  it('floors the halved value when the result is not a whole number', () => {
    const game = setupGame()

    // High Card has baseChips=5, baseMult=1
    // After halving: chips=floor(5/2)=2, mult=floor(1/2)=0
    const cardId = Object.keys(game.cards)[0]!

    const gameWithCards: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedCardIds: [cardId],
        handIds: [cardId],
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    // High Card: baseChips=5, baseMult=1 → halved: chips=2, mult=0
    expect(after.gamePlayState.score.chips).toBe(2)
    expect(after.gamePlayState.score.mult).toBe(0)
  })
})
