import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The Arm boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Arm'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    return { ...game, ...overrides }
  }

  it('decreases played poker hand level by 1', () => {
    const game = setupGame()
    game.pokerHands.pair.level = 3
    // Set up cards for a pair
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.pokerHands.pair.level).toBe(2)
  })

  it('does not decrease below level 1', () => {
    const game = setupGame()
    game.pokerHands.pair.level = 1
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.pokerHands.pair.level).toBe(1)
  })
})
