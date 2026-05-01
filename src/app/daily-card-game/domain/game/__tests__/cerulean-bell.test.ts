import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Cerulean Bell boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'Cerulean Bell'
    game.gamePlayState.handIds = Object.keys(game.cards).slice(0, 5)
    return game
  }

  it('selects one card from the hand when the boss blind starts', () => {
    const game = setupGame()

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.gamePlayState.selectedCardIds).toHaveLength(1)
    expect(after.gamePlayState.handIds).toContain(after.gamePlayState.selectedCardIds[0])
    expect(after.gamePlayState.selectedHand?.[1].map(card => card.id)).toEqual(
      after.gamePlayState.selectedCardIds
    )
  })

  it('keeps the forced card selected when trying to deselect it', () => {
    const afterStart = reduceGame(setupGame(), { type: 'BOSS_BLIND_SELECTED' })
    const forcedCardId = afterStart.gamePlayState.selectedCardIds[0]

    const afterDeselect = reduceGame(afterStart, { type: 'CARD_DESELECTED', id: forcedCardId })

    expect(afterDeselect.gamePlayState.selectedCardIds).toContain(forcedCardId)
  })
})
