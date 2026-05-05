import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState, ScoringEvent } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

const GAME_SEED = 'test-seed'

function findMisprintEvent(game: GameState): ScoringEvent | undefined {
  return game.gamePlayState.scoringEvents.find(
    (e): e is ScoringEvent => 'source' in e && (e as ScoringEvent).source === 'Misprint'
  ) as ScoringEvent | undefined
}

describe('Misprint joker', () => {
  it('adds a Mult bonus between 0 and 23', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.misprint, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED
    game.handsPlayed = 0

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const misprintEvent = findMisprintEvent(after)
    expect(misprintEvent).toBeDefined()
    expect(misprintEvent!.value).toBeGreaterThanOrEqual(0)
    expect(misprintEvent!.value).toBeLessThanOrEqual(23)
  })

  it('scoring event has source Misprint and type mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.misprint, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED
    game.handsPlayed = 0

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const misprintEvent = findMisprintEvent(after)
    expect(misprintEvent).toBeDefined()
    expect(misprintEvent).toMatchObject({ source: 'Misprint', type: 'mult' })
  })

  it('bonus is deterministic with the same seed and handsPlayed', () => {
    const makeGame = (): GameState => {
      const game: GameState = structuredClone(defaultGameState)
      game.jokers = [initializeJoker(jokers.misprint, game)]
      game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
      game.gamePhase = 'gameplay'
      game.gameSeed = GAME_SEED
      game.handsPlayed = 1
      return game
    }

    const result1 = reduceGame(makeGame(), { type: 'HAND_SCORING_FINALIZE' })
    const result2 = reduceGame(makeGame(), { type: 'HAND_SCORING_FINALIZE' })

    const event1 = findMisprintEvent(result1)
    const event2 = findMisprintEvent(result2)

    expect(event1).toBeDefined()
    expect(event2).toBeDefined()
    expect(event1!.value).toBe(event2!.value)
  })

  it('different handsPlayed values produce different bonuses', () => {
    const makeGame = (handsPlayed: number): GameState => {
      const game: GameState = structuredClone(defaultGameState)
      game.jokers = [initializeJoker(jokers.misprint, game)]
      game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
      game.gamePhase = 'gameplay'
      game.gameSeed = GAME_SEED
      game.handsPlayed = handsPlayed
      return game
    }

    const result0 = reduceGame(makeGame(0), { type: 'HAND_SCORING_FINALIZE' })
    const result1 = reduceGame(makeGame(1), { type: 'HAND_SCORING_FINALIZE' })
    const result2 = reduceGame(makeGame(2), { type: 'HAND_SCORING_FINALIZE' })

    const val0 = findMisprintEvent(result0)?.value
    const val1 = findMisprintEvent(result1)?.value
    const val2 = findMisprintEvent(result2)?.value

    // All should be defined and in range
    expect(val0).toBeDefined()
    expect(val1).toBeDefined()
    expect(val2).toBeDefined()
    // At least two should differ to prove seed varies with handsPlayed
    expect(new Set([val0, val1, val2]).size).toBeGreaterThan(1)
  })
})
