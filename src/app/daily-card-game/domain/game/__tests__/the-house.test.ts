import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The House boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The House'
    return { ...game, ...overrides }
  }

  it('flips all cards face down on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: '2_hearts', isFaceUp: true, flags: {} } as any,
      'c3': { id: 'c3', playingCardId: 'K_diamonds', isFaceUp: true, flags: {} } as any,
    }
    game.ownedCardIds = ['c1', 'c2', 'c3']

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.cards['c1'].isFaceUp).toBe(false)
    expect(after.cards['c2'].isFaceUp).toBe(false)
    expect(after.cards['c3'].isFaceUp).toBe(false)
  })
})
