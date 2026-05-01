import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Obelisk joker', () => {
  it('increases counter when non-most-played hand is played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.obelisk, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.score = { chips: 10, mult: 1 }
    // Make 'flush' the most played hand
    game.pokerHands.flush.timesPlayed = 5
    game.pokerHands.pair.timesPlayed = 1

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const ob = after.jokers.find(j => j.jokerId === 'obelisk')
    // counter starts at 5 (lazy init), increments to 6
    expect(ob?.counter).toBe(6)
  })

  it('resets counter to 5 when most played hand is played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.obelisk, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Set counter above baseline to verify reset
    game.jokers[0].counter = 8
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.score = { chips: 10, mult: 1 }
    // Make 'pair' the most played hand
    game.pokerHands.pair.timesPlayed = 10
    game.pokerHands.flush.timesPlayed = 3

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const ob = after.jokers.find(j => j.jokerId === 'obelisk')
    expect(ob?.counter).toBe(5)
  })

  it('applies X Mult when counter exceeds 5', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.obelisk, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Set counter to 5 so it becomes 6 after increment (X1.2)
    game.jokers[0].counter = 5
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.score = { chips: 10, mult: 2 }
    // Make 'flush' the most played hand so pair is not most played
    game.pokerHands.flush.timesPlayed = 5
    game.pokerHands.pair.timesPlayed = 1

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // counter goes 5 -> 6, xMult = 6/5 = 1.2
    const obeliskEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Obelisk'
    ) as { operator: string; value: number } | undefined
    expect(obeliskEvent).toBeTruthy()
    expect(obeliskEvent?.operator).toBe('x')
    expect(Math.abs((obeliskEvent?.value ?? 0) - 1.2)).toBeLessThan(0.0001)
  })

  it('does not apply X Mult when counter equals 5 (X1.0 baseline)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.obelisk, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // counter = 0 triggers lazy init to 5, then most-played hand resets to 5 => no scoring event
    game.gamePlayState.selectedHand = ['pair', []]
    game.gamePlayState.score = { chips: 10, mult: 2 }
    // Make 'pair' the most played hand
    game.pokerHands.pair.timesPlayed = 10

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Obelisk'
    )).toBe(false)
  })
})
