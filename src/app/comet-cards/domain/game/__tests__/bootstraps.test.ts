import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Bootstraps joker', () => {
  it('adds +2 Mult per $5 on HAND_SCORING_FINALIZE', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bootstrapsJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const started = reduceGame(game, { type: 'GAME_START' })
    const withMoney: GameState = { ...started, money: 25 }
    const afterScore = reduceGame(withMoney, { type: 'HAND_SCORING_FINALIZE' })

    // $25 / $5 = 5, * 2 = +10 Mult
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bootstraps' && e.value === 10
    )).toBe(true)
  })

  it('adds 0 Mult when money is less than $5', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bootstrapsJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const started = reduceGame(game, { type: 'GAME_START' })
    const withLowMoney: GameState = { ...started, money: 3 }
    const afterScore = reduceGame(withLowMoney, { type: 'HAND_SCORING_FINALIZE' })

    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bootstraps'
    )).toBe(false)
  })
})
