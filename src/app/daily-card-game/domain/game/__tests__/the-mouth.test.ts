import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('The Mouth boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Mouth'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('allows first hand of the round to score normally', () => {
    const game = setupGame()

    // handTypesPlayedThisRound is empty - this is the first hand
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
        handTypesPlayedThisRound: [],
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    // Pair: baseChips=10, baseMult=2 - should score normally
    expect(after.gamePlayState.score.chips).toBeGreaterThan(0)
    expect(after.gamePlayState.score.mult).toBeGreaterThan(0)
  })

  it('allows same hand type as first hand to score normally', () => {
    const game = setupGame()

    // Simulate pair was already played this round
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
        handTypesPlayedThisRound: ['pair'], // pair was played before
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    // Playing another pair - should score normally
    expect(after.gamePlayState.score.chips).toBeGreaterThan(0)
    expect(after.gamePlayState.score.mult).toBeGreaterThan(0)
  })

  it('zeros out score when a different hand type is played after the first', () => {
    const game = setupGame()

    // Simulate pair was already played this round; now play a high card
    const cardId = Object.keys(game.cards)[0]!

    const gameWithCards: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedCardIds: [cardId],
        handIds: [cardId],
        handTypesPlayedThisRound: ['pair'], // pair was played first, now playing highCard
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    // Different hand type - should be zeroed out
    expect(after.gamePlayState.score.chips).toBe(0)
    expect(after.gamePlayState.score.mult).toBe(0)
    expect(after.gamePlayState.cardsToScore).toHaveLength(0)
  })
})
