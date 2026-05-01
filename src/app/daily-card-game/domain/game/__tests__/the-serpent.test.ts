import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The Serpent boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Serpent'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('draws exactly 3 cards after discarding during boss blind', () => {
    const game = setupGame()

    // Put 8 cards in hand, 10 in draw pile, select 2 to discard
    const allIds = game.ownedCardIds
    const handIds = allIds.slice(0, 8)
    const drawPileIds = allIds.slice(8, 18)
    const selectedCardIds = handIds.slice(0, 2)

    const state: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        handIds,
        drawPileIds,
        selectedCardIds,
        remainingDiscards: 3,
      },
    }

    const after = reduceGame(state, { type: 'DISCARD_SELECTED_CARDS' })

    // After discard: 8 - 2 = 6 cards in hand, then draw 3 → expect 9
    expect(after.gamePlayState.handIds).toHaveLength(9)
  })

  it('draws exactly 3 cards after playing a hand during boss blind (continue outcome)', () => {
    const game = setupGame()

    // Put 8 cards in hand, 10 in draw pile, select 1 to play (scores low so outcome is 'continue')
    const allIds = game.ownedCardIds
    const selectedCardId = allIds[0]
    const handIds = allIds.slice(0, 8)
    const drawPileIds = allIds.slice(8, 18)

    const state: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        handIds,
        drawPileIds,
        selectedCardIds: [selectedCardId],
        // Low score so blindScore < ante (600n) and outcome is 'continue'
        score: { chips: 1, mult: 1 },
        selectedHand: ['highCard', [game.cards[selectedCardId]]],
        playedCardIds: [selectedCardId],
        remainingHands: 3, // > 0 so not gameOver
      },
    }

    const after = reduceGame(state, { type: 'HAND_SCORING_FINALIZE' })

    // After play: 8 - 1 (played) = 7 cards remain, then draw 3 → expect 10
    expect(after.gamePlayState.handIds).toHaveLength(10)
  })

  it('draws to fill hand normally when not the serpent boss blind', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Hook'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const allIds = game.ownedCardIds
    const handIds = allIds.slice(0, 5) // 5 cards in hand (hand size = 8, so needs 3 more)
    const drawPileIds = allIds.slice(5, 15)
    const selectedCardIds = handIds.slice(0, 2)

    const state: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        handIds,
        drawPileIds,
        selectedCardIds,
        remainingDiscards: 3,
      },
    }

    const after = reduceGame(state, { type: 'DISCARD_SELECTED_CARDS' })

    // After discard: 5 - 2 = 3 cards in hand, then normal refill to HAND_SIZE (8) → expect 8
    expect(after.gamePlayState.handIds).toHaveLength(8)
  })
})
