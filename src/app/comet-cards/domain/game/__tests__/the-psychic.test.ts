import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('The Psychic boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Psychic'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    return { ...game, ...overrides }
  }

  it('zeroes out scoring when fewer than 5 cards are played', () => {
    const game = setupGame()
    // Set up 3 cards (fewer than 5)
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
      'c3': { id: 'c3', playingCardId: 'A_diamonds', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2', 'c3']
    game.gamePlayState.handIds = ['c1', 'c2', 'c3']
    game.ownedCardIds = ['c1', 'c2', 'c3']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.gamePlayState.score.chips).toBe(0)
    expect(after.gamePlayState.score.mult).toBe(0)
    expect(after.gamePlayState.cardsToScore).toHaveLength(0)
  })

  it('allows scoring when exactly 5 cards are played', () => {
    const game = setupGame()
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
      'c3': { id: 'c3', playingCardId: '2_clubs', isFaceUp: true, flags: {} } as any,
      'c4': { id: 'c4', playingCardId: '3_clubs', isFaceUp: true, flags: {} } as any,
      'c5': { id: 'c5', playingCardId: '4_clubs', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2', 'c3', 'c4', 'c5']
    game.gamePlayState.handIds = ['c1', 'c2', 'c3', 'c4', 'c5']
    game.ownedCardIds = ['c1', 'c2', 'c3', 'c4', 'c5']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.gamePlayState.score.chips).toBeGreaterThan(0)
  })
})
