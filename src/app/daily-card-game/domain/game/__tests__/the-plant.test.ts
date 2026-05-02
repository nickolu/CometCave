import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('The Plant boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Plant'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('removes face cards (J, Q, K) from cardsToScore at HAND_SCORING_START', () => {
    const game = setupGame()

    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!
    const queenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'Q'
    )!
    const kingId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    )!
    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    const gameWithCards: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedCardIds: [jackId, queenId, kingId, aceId],
        handIds: [jackId, queenId, kingId, aceId],
        cardsToScore: [game.cards[jackId], game.cards[queenId], game.cards[kingId], game.cards[aceId]],
      },
    }

    const after = reduceGame(gameWithCards, { type: 'HAND_SCORING_START' })

    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).not.toContain(jackId)
    expect(scoredIds).not.toContain(queenId)
    expect(scoredIds).not.toContain(kingId)
    expect(scoredIds).toContain(aceId)
  })

  it('does not remove non-face cards from cardsToScore', () => {
    const game = setupGame()

    // Find two aces (same value to form a pair) so both score
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

    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).toContain(aceId1)
    expect(scoredIds).toContain(aceId2)
  })
})
