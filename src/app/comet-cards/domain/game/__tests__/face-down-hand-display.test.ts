import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('face-down cards and Selected Hand display (bug #1616)', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Set up three cards: two Kings (face-up) and one 5 (face-down)
    game.cards = {
      'c1': { id: 'c1', playingCardId: 'K_spades', isFaceUp: true, flags: {} } as any,
      'c2': { id: 'c2', playingCardId: 'K_hearts', isFaceUp: true, flags: {} } as any,
      'c3': { id: 'c3', playingCardId: '5_clubs', isFaceUp: false, flags: {} } as any,
    }
    game.gamePlayState.handIds = ['c1', 'c2', 'c3']
    game.ownedCardIds = ['c1', 'c2', 'c3']
    game.gamePlayState.selectedCardIds = []
    game.gamePlayState.selectedHand = undefined

    return game
  }

  it('shows Pair (from two face-up Kings) when a face-down card is also selected', () => {
    const game = setupGame()

    // Select K♠ (face-up)
    const after1 = reduceGame(game, { type: 'CARD_SELECTED', id: 'c1' })
    // Select K♥ (face-up)
    const after2 = reduceGame(after1, { type: 'CARD_SELECTED', id: 'c2' })
    // Select 5♣ (face-down)
    const after3 = reduceGame(after2, { type: 'CARD_SELECTED', id: 'c3' })

    expect(after3.gamePlayState.selectedHand).toBeDefined()
    // Hand ID should be 'pair' — determined only from the two face-up Kings
    expect(after3.gamePlayState.selectedHand![0]).toBe('pair')
    // All three cards (including face-down) are in the hand for scoring
    expect(after3.gamePlayState.selectedHand![1]).toHaveLength(3)
  })

  it('selectedHand is undefined when only face-down cards are selected', () => {
    const game = setupGame()

    // Select only the face-down 5♣
    const after = reduceGame(game, { type: 'CARD_SELECTED', id: 'c3' })

    expect(after.gamePlayState.selectedHand).toBeUndefined()
  })

  it('shows Pair after deselecting the face-down card leaves two face-up Kings', () => {
    const game = setupGame()

    // Select all three cards
    const after1 = reduceGame(game, { type: 'CARD_SELECTED', id: 'c1' })
    const after2 = reduceGame(after1, { type: 'CARD_SELECTED', id: 'c2' })
    const after3 = reduceGame(after2, { type: 'CARD_SELECTED', id: 'c3' })

    // Now deselect the face-down card
    const after4 = reduceGame(after3, { type: 'CARD_DESELECTED', id: 'c3' })

    expect(after4.gamePlayState.selectedHand).toBeDefined()
    expect(after4.gamePlayState.selectedHand![0]).toBe('pair')
    expect(after4.gamePlayState.selectedHand![1]).toHaveLength(2)
  })

  it('selectedHand is undefined after deselecting to leave only face-down cards', () => {
    const game = setupGame()

    // Select K♠ (face-up) and 5♣ (face-down)
    const after1 = reduceGame(game, { type: 'CARD_SELECTED', id: 'c1' })
    const after2 = reduceGame(after1, { type: 'CARD_SELECTED', id: 'c3' })

    // Deselect K♠ — only face-down 5♣ remains
    const after3 = reduceGame(after2, { type: 'CARD_DESELECTED', id: 'c1' })

    expect(after3.gamePlayState.selectedHand).toBeUndefined()
  })
})
