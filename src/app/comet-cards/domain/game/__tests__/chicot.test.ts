import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Chicot joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    // Force the boss blind to The Hook for deterministic testing
    game.rounds[game.roundIndex].bossBlindName = 'The Hook'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return { ...game, ...overrides }
  }

  it('disables boss blind effects when Chicot is present: The Hook does not discard cards', () => {
    const game = setupGame()
    game.jokers = [initializeJoker(jokers.chicot, game)]

    // Add card IDs to hand so The Hook would have something to discard
    const cardIds = ['card1', 'card2', 'card3']
    game.gamePlayState = {
      ...game.gamePlayState,
      handIds: [...cardIds],
    }

    const after = reduceGame(game, { type: 'HAND_SCORING_DONE_CARD_SCORING' })

    // With Chicot present, The Hook's effect should not fire — hand should be unchanged
    expect(after.gamePlayState.handIds).toEqual(cardIds)
  })

  it('boss blind effects fire normally without Chicot: The Hook discards cards', () => {
    const game = setupGame()
    game.jokers = []

    // Add card IDs to hand so The Hook can discard them
    const cardIds = ['card1', 'card2', 'card3']
    game.gamePlayState = {
      ...game.gamePlayState,
      handIds: [...cardIds],
    }

    const after = reduceGame(game, { type: 'HAND_SCORING_DONE_CARD_SCORING' })

    // Without Chicot, The Hook's effect should fire — up to 2 cards discarded
    expect(after.gamePlayState.handIds.length).toBeLessThan(cardIds.length)
  })
})
