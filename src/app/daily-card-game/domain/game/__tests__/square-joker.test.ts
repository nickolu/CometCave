import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Square Joker', () => {
  it('increases counter by 4 when exactly 4 cards are played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.squareJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        playedCardIds: ['c1', 'c2', 'c3', 'c4'],
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const sj = after.jokers.find(j => j.jokerId === 'squareJoker')
    expect(sj?.counter).toBe(4)
  })

  it('does not increase counter when != 4 cards are played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.squareJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        playedCardIds: ['c1', 'c2', 'c3'],
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const sj = after.jokers.find(j => j.jokerId === 'squareJoker')
    expect(sj?.counter).toBe(0)
  })

  it('applies accumulated chips bonus on the hand where 4 cards are played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.squareJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    // First 4-card hand: counter goes from 0 to 4, bonus of 4 is applied
    const hand1: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        playedCardIds: ['c1', 'c2', 'c3', 'c4'],
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after1 = reduceGame(hand1, { type: 'HAND_SCORING_FINALIZE' })
    expect(after1.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Square Joker' && 'value' in e && e.value === 4
    )).toBe(true)

    // Second 4-card hand: counter goes to 8, bonus of 8 is applied
    const hand2: GameState = {
      ...after1,
      gamePlayState: {
        ...after1.gamePlayState,
        scoringEvents: [],
        playedCardIds: ['c1', 'c2', 'c3', 'c4'],
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after2 = reduceGame(hand2, { type: 'HAND_SCORING_FINALIZE' })
    const sj2 = after2.jokers.find(j => j.jokerId === 'squareJoker')
    expect(sj2?.counter).toBe(8)
    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Square Joker' && 'value' in e && e.value === 8
    )).toBe(true)
  })
})
