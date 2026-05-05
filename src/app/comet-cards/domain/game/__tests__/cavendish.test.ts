import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

// With gameSeed='seed-1784', roundIndex=1 (default): roll=1 (self-destruct)
// With gameSeed='test-seed', roundIndex=1 (default): roll=652 (survive)
const DESTROY_SEED = 'seed-1784'
const SURVIVE_SEED = 'test-seed'

describe('Cavendish joker', () => {
  it('gives X3 Mult on HAND_SCORING_FINALIZE', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cavendish, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const before = game.gamePlayState.score.mult
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.score.mult).toBe(before * 3)
  })

  it('scoring event has operator x, value 3, source Cavendish', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cavendish, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Cavendish' && e.value === 3 && 'operator' in e && e.operator === 'x'
    )).toBe(true)
  })

  it('self-destructs on ROUND_END when roll=1', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gameSeed = DESTROY_SEED
    game.jokers = [initializeJoker(jokers.cavendish, game)]
    const after = reduceGame(game, { type: 'ROUND_END' })
    expect(after.jokers.some(j => j.jokerId === 'cavendish')).toBe(false)
  })

  it('survives ROUND_END when roll!=1', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gameSeed = SURVIVE_SEED
    game.jokers = [initializeJoker(jokers.cavendish, game)]
    const after = reduceGame(game, { type: 'ROUND_END' })
    expect(after.jokers.some(j => j.jokerId === 'cavendish')).toBe(true)
  })
})
