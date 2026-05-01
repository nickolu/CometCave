import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Blue Joker', () => {
  it('adds +2 Chips per card in draw pile', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.blueJokerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.drawPileIds = ['a', 'b', 'c', 'd', 'e'] // 5 cards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Blue Joker' && e.value === 10
    )).toBe(true)
  })

  it('no effect with empty draw pile', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.blueJokerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.drawPileIds = []
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Blue Joker'
    )).toBe(false)
  })
})
