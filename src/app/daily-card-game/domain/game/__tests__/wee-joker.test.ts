import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Wee Joker', () => {
  it('initializes with 0 chips bonus', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.weeJokerJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    const wj = started.jokers.find(j => j.jokerId === 'weeJokerJoker')
    expect(wj?.metadata?.chipsBonus).toBe(0)
  })

  it('does not add chips on HAND_SCORING_FINALIZE when no 2s scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.weeJokerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })
    const afterScore = reduceGame(started, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Wee Joker'
    )).toBe(false)
  })
})
