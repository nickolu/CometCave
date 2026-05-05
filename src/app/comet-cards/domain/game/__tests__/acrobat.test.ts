import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Acrobat joker', () => {
  it('applies X3 Mult on final hand (remainingHands === 0)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.acrobatJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.remainingHands = 0 // final hand
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Acrobat' && 'operator' in e && e.operator === 'x' && e.value === 3
    )).toBe(true)
  })

  it('does not apply X3 Mult on non-final hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.acrobatJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.remainingHands = 2 // not final
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Acrobat'
    )).toBe(false)
  })
})
