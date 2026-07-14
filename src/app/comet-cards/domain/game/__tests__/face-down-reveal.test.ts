import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('face-down card reveal on play', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePhase = 'gameplay'
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: false, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'K_hearts', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']
    return game
  }

  it('flips face-down cards face-up when played', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.cards['c1'].isFaceUp).toBe(true)
  })

  it('leaves already face-up cards face-up (no regression)', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    expect(after.cards['c2'].isFaceUp).toBe(true)
  })
})
