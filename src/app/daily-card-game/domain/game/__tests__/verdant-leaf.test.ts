import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Verdant Leaf showdown boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'Verdant Leaf'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    return { ...game, ...overrides }
  }

  it('debuffs all cards (clears cardsToScore) on HAND_SCORING_START', () => {
    const game = setupGame()
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.gamePlayState.cardsToScore).toHaveLength(0)
    expect(after.gamePlayState.score.chips).toBe(0)
    expect(after.gamePlayState.score.mult).toBe(0)
  })
})
