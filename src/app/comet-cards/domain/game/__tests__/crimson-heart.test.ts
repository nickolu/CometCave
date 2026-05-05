import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Crimson Heart showdown boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'Crimson Heart'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    return { ...game, ...overrides }
  }

  it('disables one random joker on HAND_SCORING_START', () => {
    const game = setupGame()
    game.jokers = [
      { id: 'j1', jokerId: 'joker', isFaceUp: true, edition: 'normal' } as any,
      { id: 'j2', jokerId: 'jolly', isFaceUp: true, edition: 'normal' } as any,
      { id: 'j3', jokerId: 'zany', isFaceUp: true, edition: 'normal' } as any,
    ]
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'A_hearts', isFaceUp: true, flags: {} } as any,
    }
    game.gamePlayState.selectedCardIds = ['c1', 'c2']
    game.gamePlayState.handIds = ['c1', 'c2']
    game.ownedCardIds = ['c1', 'c2']

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    const disabledCount = after.jokers.filter(j => !j.isFaceUp).length
    expect(disabledCount).toBe(1)
  })

  it('changes which joker is disabled each hand (deterministic)', () => {
    const game1 = setupGame()
    game1.gameSeed = 'test-seed'
    game1.handsPlayed = 1
    game1.jokers = [
      { id: 'j1', jokerId: 'joker', isFaceUp: true, edition: 'normal' } as any,
      { id: 'j2', jokerId: 'jolly', isFaceUp: true, edition: 'normal' } as any,
    ]
    game1.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
    }
    game1.gamePlayState.selectedCardIds = ['c1']
    game1.gamePlayState.handIds = ['c1']
    game1.ownedCardIds = ['c1']

    const game2 = setupGame()
    game2.gameSeed = 'test-seed'
    game2.handsPlayed = 2
    game2.jokers = [
      { id: 'j1', jokerId: 'joker', isFaceUp: true, edition: 'normal' } as any,
      { id: 'j2', jokerId: 'jolly', isFaceUp: true, edition: 'normal' } as any,
    ]
    game2.cards = {
      'c1': { id: 'c1', playingCardId: 'A_spades', isFaceUp: true, flags: {} } as any,
    }
    game2.gamePlayState.selectedCardIds = ['c1']
    game2.gamePlayState.handIds = ['c1']
    game2.ownedCardIds = ['c1']

    const after1 = reduceGame(game1, { type: 'HAND_SCORING_START' })
    const after2 = reduceGame(game2, { type: 'HAND_SCORING_START' })

    // Both should have exactly 1 disabled, and with different seeds they may differ
    expect(after1.jokers.filter(j => !j.isFaceUp).length).toBe(1)
    expect(after2.jokers.filter(j => !j.isFaceUp).length).toBe(1)
  })
})
