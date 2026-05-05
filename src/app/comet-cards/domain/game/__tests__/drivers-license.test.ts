import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe("Driver's License joker", () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.driversLicense, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('applies X3 Mult when 16 or more Enhanced cards are in the full deck', () => {
    const game = setupGame()
    // Enhance exactly 16 cards
    const cardIds = game.ownedCardIds.slice(0, 16)
    for (const id of cardIds) {
      game.cards[id].flags.enchantment = 'bonus'
    }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(
        e =>
          'source' in e &&
          e.source === "Driver's License" &&
          'operator' in e &&
          e.operator === 'x' &&
          e.value === 3,
      ),
    ).toBe(true)
  })

  it('does not apply X3 Mult when fewer than 16 Enhanced cards are in the full deck', () => {
    const game = setupGame()
    // Enhance only 15 cards
    const cardIds = game.ownedCardIds.slice(0, 15)
    for (const id of cardIds) {
      game.cards[id].flags.enchantment = 'bonus'
    }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === "Driver's License",
      ),
    ).toBe(false)
  })
})
