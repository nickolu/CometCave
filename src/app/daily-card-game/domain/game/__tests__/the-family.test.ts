import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('The Family joker', () => {
  it('applies X4 Mult when hand contains four of a kind', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.theFamilyJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.selectedHand = ['fourOfAKind', []]
    game.gamePlayState.score = { chips: 10, mult: 5 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'The Family' && 'operator' in e && e.operator === 'x' && e.value === 4
    )).toBe(true)
  })

  it('does not apply when hand has no four of a kind', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.theFamilyJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.selectedHand = ['threeOfAKind', []]
    game.gamePlayState.score = { chips: 10, mult: 5 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'The Family'
    )).toBe(false)
  })
})
