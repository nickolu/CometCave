import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Ice Cream joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.iceCream, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return reduceGame(game, { type: 'GAME_START' })
  }

  it('gives +100 Chips on first hand (counter initializes to 100)', () => {
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
      e => 'source' in e && e.source === 'Ice Cream' && 'value' in e && e.value === 100
    )).toBe(true)
  })

  it('gives +95 Chips on second hand (counter decremented to 95 after first)', () => {
    const started = setupGame()
    const hand1: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 0, mult: 1 },
      },
    }
    const after1 = reduceGame(hand1, { type: 'HAND_SCORING_FINALIZE' })

    const hand2: GameState = {
      ...after1,
      gamePlayState: {
        ...after1.gamePlayState,
        scoringEvents: [],
        score: { chips: 0, mult: 1 },
      },
    }
    const after2 = reduceGame(hand2, { type: 'HAND_SCORING_FINALIZE' })

    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ice Cream' && 'value' in e && e.value === 95
    )).toBe(true)
  })

  it('self-destructs when counter reaches 0', () => {
    const started = setupGame()

    // Play 20 hands to deplete from 100 to 0 (100 / 5 = 20 hands)
    let state: GameState = started
    for (let i = 0; i < 20; i++) {
      state = reduceGame(
        {
          ...state,
          gamePlayState: {
            ...state.gamePlayState,
            scoringEvents: [],
            score: { chips: 0, mult: 1 },
            selectedHand: ['pair', []],
          },
        },
        { type: 'HAND_SCORING_FINALIZE' }
      )
    }

    const iceCreamInstance = state.jokers.find(j => j.jokerId === 'iceCream')
    expect(iceCreamInstance).toBeUndefined()
  })
})
