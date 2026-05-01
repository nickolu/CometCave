import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

// With gameSeed='test-seed', roundIndex=1 (default), the expected rolls are:
// handsPlayed=0 → 21
// handsPlayed=1 → 7
// handsPlayed=2 → 5
const GAME_SEED = 'test-seed'

describe('Misprint joker', () => {
  it('adds a Mult bonus between 0 and 23', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.misprint, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED
    game.gamePlayState.handsPlayed = 0

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const misprintEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )
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
    game.gamePlayState.handsPlayed = 0

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const misprintEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )
    expect(misprintEvent).toBeDefined()
    expect(misprintEvent).toMatchObject({ source: 'Misprint', type: 'mult', value: 21 })
  })

  it('bonus is deterministic with the same seed and handsPlayed', () => {
    const makeGame = (): GameState => {
      const game: GameState = structuredClone(defaultGameState)
      game.jokers = [initializeJoker(jokers.misprint, game)]
      game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
      game.gamePhase = 'gameplay'
      game.gameSeed = GAME_SEED
      game.gamePlayState.handsPlayed = 1
      return game
    }

    const result1 = reduceGame(makeGame(), { type: 'HAND_SCORING_FINALIZE' })
    const result2 = reduceGame(makeGame(), { type: 'HAND_SCORING_FINALIZE' })

    const event1 = result1.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )
    const event2 = result2.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )

    expect(event1?.value).toBe(event2?.value)
    expect(event1?.value).toBe(7)
  })

  it('different handsPlayed values produce different bonuses', () => {
    const makeGame = (handsPlayed: number): GameState => {
      const game: GameState = structuredClone(defaultGameState)
      game.jokers = [initializeJoker(jokers.misprint, game)]
      game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
      game.gamePhase = 'gameplay'
      game.gameSeed = GAME_SEED
      game.gamePlayState.handsPlayed = handsPlayed
      return game
    }

    const result0 = reduceGame(makeGame(0), { type: 'HAND_SCORING_FINALIZE' })
    const result1 = reduceGame(makeGame(1), { type: 'HAND_SCORING_FINALIZE' })
    const result2 = reduceGame(makeGame(2), { type: 'HAND_SCORING_FINALIZE' })

    const val0 = result0.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )?.value
    const val1 = result1.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )?.value
    const val2 = result2.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Misprint'
    )?.value

    // Expected: handsPlayed=0 → 21, handsPlayed=1 → 7, handsPlayed=2 → 5
    expect(val0).toBe(21)
    expect(val1).toBe(7)
    expect(val2).toBe(5)
    // Verify they are all different
    expect(new Set([val0, val1, val2]).size).toBe(3)
  })
})
