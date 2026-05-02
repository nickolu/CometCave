import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('The Eye boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Eye'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('allows first hand of any type to score normally', () => {
    const game = setupGame()

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

  it('allows a different hand type on a subsequent hand to score normally', () => {
    const game = setupGame()

    // Play a single card (highCard) after a flush was already played
    const cardId = Object.keys(game.cards)[0]!

    const gameWithCards: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedCardIds: [cardId],
        handIds: [cardId],
        handTypesPlayedThisRound: ['flush'], // flush was played before, now playing highCard
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    // Different hand type - should score normally
    expect(after.gamePlayState.score.chips).toBeGreaterThan(0)
    expect(after.gamePlayState.score.mult).toBeGreaterThan(0)
  })

  it('zeros out score when the same hand type is played again', () => {
    const game = setupGame()

    // pair was already played this round; playing another pair now
    // When HAND_SCORING_START fires, the handler pushes 'pair' making it ['pair', 'pair']
    // then The Eye effect sees count=2 and zeros out scoring
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

    // Repeated hand type - should be zeroed out
    expect(after.gamePlayState.score.chips).toBe(0)
    expect(after.gamePlayState.score.mult).toBe(0)
    expect(after.gamePlayState.cardsToScore).toHaveLength(0)
  })
})
