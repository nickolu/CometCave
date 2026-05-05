import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Splash joker', () => {
  /**
   * Helper that picks cards from the default game's card registry by value.
   * Returns card IDs whose playing card has the given value.
   */
  function getCardIdsByValue(game: GameState, value: string): string[] {
    return Object.keys(game.cards).filter(
      id => playingCards[game.cards[id].playingCardId]?.value === value
    )
  }

  it('expands cardsToScore to include all played cards, not just hand cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.splash, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Pick two Aces (they form a pair — the winning hand from 3 selected cards)
    const aceIds = getCardIdsByValue(game, 'A')
    // Pick one King (does not participate in the pair hand)
    const kingIds = getCardIdsByValue(game, 'K')

    expect(aceIds.length).toBeGreaterThanOrEqual(2)
    expect(kingIds.length).toBeGreaterThanOrEqual(1)

    const selectedIds = [aceIds[0], aceIds[1], kingIds[0]]

    game.gamePlayState.selectedCardIds = selectedIds
    game.gamePlayState.handIds = selectedIds

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    // With Splash, all 3 played cards should be in cardsToScore
    expect(after.gamePlayState.cardsToScore.length).toBe(3)
    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).toContain(aceIds[0])
    expect(scoredIds).toContain(aceIds[1])
    expect(scoredIds).toContain(kingIds[0])
  })

  it('without Splash, only hand cards (the pair) are in cardsToScore', () => {
    const game: GameState = structuredClone(defaultGameState)
    // No Splash joker
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const aceIds = getCardIdsByValue(game, 'A')
    const kingIds = getCardIdsByValue(game, 'K')

    const selectedIds = [aceIds[0], aceIds[1], kingIds[0]]

    game.gamePlayState.selectedCardIds = selectedIds
    game.gamePlayState.handIds = selectedIds

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    // Without Splash, only the 2 Aces (the pair) should be in cardsToScore
    expect(after.gamePlayState.cardsToScore.length).toBe(2)
    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).toContain(aceIds[0])
    expect(scoredIds).toContain(aceIds[1])
    expect(scoredIds).not.toContain(kingIds[0])
  })

  it('does not duplicate cards already in cardsToScore', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.splash, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Play a single high card — cardsToScore will already contain that card
    const aceIds = getCardIdsByValue(game, 'A')
    expect(aceIds.length).toBeGreaterThanOrEqual(1)

    const selectedIds = [aceIds[0]]
    game.gamePlayState.selectedCardIds = selectedIds
    game.gamePlayState.handIds = selectedIds

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    // Should still be exactly 1 card (no duplicate)
    const scoredAceCount = after.gamePlayState.cardsToScore.filter(
      c => c.id === aceIds[0]
    ).length
    expect(scoredAceCount).toBe(1)
  })
})
