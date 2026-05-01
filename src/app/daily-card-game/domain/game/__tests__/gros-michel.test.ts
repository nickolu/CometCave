import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

// With gameSeed='seed-a', roundIndex=1 (default): roll=1 (self-destruct)
// With gameSeed='test-seed', roundIndex=1 (default): roll=4 (survive)
const DESTROY_SEED = 'seed-a'
const SURVIVE_SEED = 'test-seed'

describe('Gros Michel joker', () => {
  it('gives +15 Mult on HAND_SCORING_FINALIZE', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.grosMichel, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Gros Michel' && e.value === 15
    )).toBe(true)
  })

  it('self-destructs on ROUND_END when roll=1', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gameSeed = DESTROY_SEED
    game.jokers = [initializeJoker(jokers.grosMichel, game)]
    const after = reduceGame(game, { type: 'ROUND_END' })
    expect(after.jokers.some(j => j.jokerId === 'grosMichel')).toBe(false)
  })

  it('survives ROUND_END when roll!=1', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gameSeed = SURVIVE_SEED
    game.jokers = [initializeJoker(jokers.grosMichel, game)]
    const after = reduceGame(game, { type: 'ROUND_END' })
    expect(after.jokers.some(j => j.jokerId === 'grosMichel')).toBe(true)
  })
})
