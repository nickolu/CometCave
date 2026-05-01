import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Popcorn joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.popcorn, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return reduceGame(game, { type: 'GAME_START' })
  }

  it('gives +20 Mult on first hand (counter initializes to 20)', () => {
    const started = setupGame()
    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 0, mult: 1 },
      },
    }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Popcorn' && 'value' in e && e.value === 20
    )).toBe(true)
  })

  it('decreases counter by 4 on ROUND_END', () => {
    // First fire HAND_SCORING_FINALIZE to initialize counter to 20
    const started = setupGame()
    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 0, mult: 1 },
      },
    }
    const afterHand = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const popcornBefore = afterHand.jokers.find(j => j.jokerId === 'popcorn')
    expect(popcornBefore?.counter).toBe(20)

    const after = reduceGame(afterHand, { type: 'ROUND_END' })
    const popcornAfter = after.jokers.find(j => j.jokerId === 'popcorn')
    expect(popcornAfter?.counter).toBe(16)
  })

  it('self-destructs when counter reaches 0', () => {
    const started = setupGame()

    // Play 5 rounds to deplete from 20 to 0 (20 / 4 = 5 rounds)
    // First trigger HAND_SCORING_FINALIZE to initialize counter
    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 0, mult: 1 },
      },
    }
    let state: GameState = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })

    for (let i = 0; i < 5; i++) {
      state = reduceGame(state, { type: 'ROUND_END' })
    }

    const popcornInstance = state.jokers.find(j => j.jokerId === 'popcorn')
    expect(popcornInstance).toBeUndefined()
  })
})
