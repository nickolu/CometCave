import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('The Fish boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Fish'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    return { ...game, ...overrides }
  }

  it('flips hand cards face down after HAND_SCORING_DONE_CARD_SCORING', () => {
    const game = setupGame()
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: '2_hearts', isFaceUp: true, flags: {} } as any,
      'c3': { id: 'c3', playingCardId: '3_clubs', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.handIds = ['c1', 'c2']
    game.gamePlayState.selectedHand = ['pair', []]
    game.ownedCardIds = ['c1', 'c2', 'c3']

    const after = reduceGame(game, { type: 'HAND_SCORING_DONE_CARD_SCORING' })
    // Cards in hand should be face down
    expect(after.cards['c1'].isFaceUp).toBe(false)
    expect(after.cards['c2'].isFaceUp).toBe(false)
    // Card not in hand should remain face up
    expect(after.cards['c3'].isFaceUp).toBe(true)
  })
})
