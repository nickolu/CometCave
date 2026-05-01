import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Throwback joker', () => {
  it('increases counter by 1 on BLIND_SKIPPED (lazy init from 0 to 4, then +1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.throwback, game)]

    const after = reduceGame(game, { type: 'BLIND_SKIPPED' })
    const tb = after.jokers.find(j => j.jokerId === 'throwback')
    // starts at 0, lazy init sets to 4, then +1 = 5
    expect(tb?.counter).toBe(5)
  })

  it('accumulates counter across multiple skips', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.throwback, game)]

    const after1 = reduceGame(game, { type: 'BLIND_SKIPPED' })
    // counter = 5 after first skip (4 + 1)

    const after2 = reduceGame(after1, { type: 'BLIND_SKIPPED' })
    const tb = after2.jokers.find(j => j.jokerId === 'throwback')
    // counter = 6 after second skip
    expect(tb?.counter).toBe(6)
  })

  it('applies X Mult scoring event on HAND_SCORING_FINALIZE when counter > 4', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.throwback, game)]

    // Skip one blind to set counter to 5 (X1.25)
    const afterSkip = reduceGame(game, { type: 'BLIND_SKIPPED' })

    const hand: GameState = {
      ...afterSkip,
      gamePhase: 'gameplay',
      rounds: afterSkip.rounds.map((r, i) =>
        i === afterSkip.roundIndex
          ? { ...r, smallBlind: { ...r.smallBlind, status: 'inProgress' } }
          : r
      ),
      gamePlayState: {
        ...afterSkip.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 4, mult: 4 },
      },
    }

    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const scoringEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Throwback'
    )
    expect(scoringEvent).toBeDefined()
    // counter = 5, xMult = 5/4 = 1.25
    expect('value' in scoringEvent! && scoringEvent.value).toBe(1.25)
  })

  it('does not apply X Mult scoring event when counter is 0 (no blinds skipped)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.throwback, game)]

    const hand: GameState = {
      ...game,
      gamePhase: 'gameplay',
      rounds: game.rounds.map((r, i) =>
        i === game.roundIndex
          ? { ...r, smallBlind: { ...r.smallBlind, status: 'inProgress' } }
          : r
      ),
      gamePlayState: {
        ...game.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 4, mult: 4 },
      },
    }

    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const scoringEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Throwback'
    )
    expect(scoringEvent).toBeUndefined()
  })
})
