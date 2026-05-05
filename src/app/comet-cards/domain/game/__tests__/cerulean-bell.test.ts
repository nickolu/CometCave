import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Cerulean Bell showdown boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'Cerulean Bell'
    return { ...game, ...overrides }
  }

  it('forces 1 card to be selected on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    game.gamePlayState.handIds = ['c1', 'c2', 'c3']
    game.gamePlayState.selectedCardIds = []
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: '2_hearts', isFaceUp: true, flags: {} } as any,
      'c3': { id: 'c3', playingCardId: '3_clubs', isFaceUp: true, flags: {} } as any,
    }
    game.ownedCardIds = ['c1', 'c2', 'c3']

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.gamePlayState.selectedCardIds.length).toBe(1)
    expect(game.gamePlayState.handIds).toContain(after.gamePlayState.selectedCardIds[0])
  })

  it('does not add duplicate if card already selected', () => {
    const game = setupGame()
    game.gamePlayState.handIds = ['c1']
    game.gamePlayState.selectedCardIds = ['c1']
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
    }
    game.ownedCardIds = ['c1']

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.gamePlayState.selectedCardIds.length).toBe(1)
  })
})
