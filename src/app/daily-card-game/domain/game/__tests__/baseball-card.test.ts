import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Baseball Card joker', () => {
  it('applies X1.5 Mult per uncommon joker owned', () => {
    const game: GameState = structuredClone(defaultGameState)
    // Baseball Card + 2 uncommon jokers (toTheMoonJoker, bullJoker)
    game.jokers = [
      initializeJoker(jokers.baseballCardJoker, game),
      initializeJoker(jokers.toTheMoonJoker, game),
      initializeJoker(jokers.bullJoker, game),
    ]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.score = { chips: 10, mult: 10 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // 2 uncommon jokers = 2 X1.5 events
    const bcEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Baseball Card'
    )
    expect(bcEvents.length).toBe(2)
  })

  it('does not apply when no uncommon jokers', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.baseballCardJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.score = { chips: 10, mult: 10 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Baseball Card'
    )).toBe(false)
  })
})
