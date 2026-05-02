import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The House boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The House'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.drawPileIds = [...game.ownedCardIds]
    return { ...game, ...overrides }
  }

  it('draws the first boss blind hand face down', () => {
    const game = setupGame()

    const after = reduceGame(game, { type: 'HAND_DEALT' })
    const dealtCards = after.gamePlayState.handIds.map(id => after.cards[id])

    expect(dealtCards.length).toBeGreaterThan(0)
    expect(dealtCards.every(card => card.isFaceUp === false)).toBe(true)
  })

  it('does not draw later hands face down', () => {
    const game = setupGame({ handsPlayed: 1 })

    const after = reduceGame(game, { type: 'HAND_DEALT' })
    const dealtCards = after.gamePlayState.handIds.map(id => after.cards[id])

    expect(dealtCards.length).toBeGreaterThan(0)
    expect(dealtCards.every(card => card.isFaceUp === true)).toBe(true)
  })

  it('does not affect non-House boss blinds', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Needle'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.drawPileIds = [...game.ownedCardIds]

    const after = reduceGame(game, { type: 'HAND_DEALT' })
    const dealtCards = after.gamePlayState.handIds.map(id => after.cards[id])

    expect(dealtCards.length).toBeGreaterThan(0)
    expect(dealtCards.every(card => card.isFaceUp === true)).toBe(true)
  })
})
