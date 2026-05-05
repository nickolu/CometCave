import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Bull joker', () => {
  it('adds +2 Chips per $1 on HAND_SCORING_FINALIZE', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bullJoker, game)]
    game.money = 25

    // Set up scoring state - need a blind in progress
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const started = reduceGame(game, { type: 'GAME_START' })

    // Trigger HAND_SCORING_FINALIZE
    const withMoney: GameState = { ...started, money: 25 }
    const afterScore = reduceGame(withMoney, { type: 'HAND_SCORING_FINALIZE' })

    // Score is reset after HAND_SCORING_FINALIZE; verify via scoringEvents
    expect(
      afterScore.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Bull' && e.value === 50
      )
    ).toBe(true)
  })

  it('adds 0 Chips when money is 0', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bullJoker, game)]
    game.money = 0
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const started = reduceGame(game, { type: 'GAME_START' })
    const withNoMoney: GameState = { ...started, money: 0 }
    const afterScore = reduceGame(withNoMoney, { type: 'HAND_SCORING_FINALIZE' })

    expect(afterScore.gamePlayState.score.chips).toBe(0)
    expect(
      afterScore.gamePlayState.scoringEvents.some(e => 'source' in e && e.source === 'Bull')
    ).toBe(false)
  })
})
