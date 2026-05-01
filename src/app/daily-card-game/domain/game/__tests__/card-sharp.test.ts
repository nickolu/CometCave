import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Card Sharp joker', () => {
  it('does not apply X3 Mult on first play of a hand type this round', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cardSharp, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.handTypesPlayedThisRound = ['pair'] // played once this round
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Card Sharp'
    )).toBe(false)
  })

  it('applies X3 Mult on second play of same hand type this round', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cardSharp, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.handTypesPlayedThisRound = ['pair', 'pair'] // played twice this round
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Card Sharp' && 'operator' in e && e.operator === 'x' && e.value === 3
    )).toBe(true)
  })

  it('does not apply X3 Mult when only a different hand type was played before', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cardSharp, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.handTypesPlayedThisRound = ['flush', 'pair'] // flush played first, then pair once
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Card Sharp'
    )).toBe(false)
  })
})
