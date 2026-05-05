import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Abstract Joker', () => {
  it('adds +3 Mult per joker owned', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      initializeJoker(jokers.abstractJokerJoker, game),
      initializeJoker(jokers.jokerJoker, game),
      initializeJoker(jokers.halfJoker, game),
    ]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // 3 jokers * 3 = +9 Mult
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Abstract Joker' && e.value === 9
    )).toBe(true)
  })
})
