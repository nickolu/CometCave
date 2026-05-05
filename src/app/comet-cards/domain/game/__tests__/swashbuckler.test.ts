import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Swashbuckler joker', () => {
  it('adds sell value of other jokers as Mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    // Swashbuckler ($4, sell=2) + jokerJoker ($2, sell=1) + halfJoker ($5, sell=2)
    game.jokers = [
      initializeJoker(jokers.swashbucklerJoker, game),
      initializeJoker(jokers.jokerJoker, game),
      initializeJoker(jokers.halfJoker, game),
    ]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // jokerJoker sell = floor(2/2)=1, halfJoker sell = floor(5/2)=2, total=3
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Swashbuckler' && e.value === 3
    )).toBe(true)
  })

  it('gives minimum +1 Mult when alone', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.swashbucklerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Swashbuckler' && e.value === 1
    )).toBe(true)
  })
})
