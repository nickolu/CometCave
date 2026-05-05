import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('The Goad boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Goad'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    return { ...game, ...overrides }
  }

  it('removes Spade cards from cardsToScore', () => {
    const game = setupGame()
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).not.toContain('c1')
    expect(scoredIds).toContain('c2')
  })

  it('does not remove non-Spade cards', () => {
    const game = setupGame()
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_diamonds', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).toContain('c1')
    expect(scoredIds).toContain('c2')
  })
})
