import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('The Tooth boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Tooth'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return { ...game, ...overrides }
  }

  it('loses $1 when a card is scored', () => {
    const game = setupGame()
    game.money = 10
    const cardId = Object.keys(game.cards)[0]
    game.gamePlayState.cardsToScore = [game.cards[cardId]]

    const after = reduceGame(game, { type: 'CARD_SCORED' })
    expect(after.money).toBe(9)
  })

  it('does not reduce money below minimum', () => {
    const game = setupGame()
    game.money = 0
    const cardId = Object.keys(game.cards)[0]
    game.gamePlayState.cardsToScore = [game.cards[cardId]]

    const after = reduceGame(game, { type: 'CARD_SCORED' })
    expect(after.money).toBe(0)
  })
})
