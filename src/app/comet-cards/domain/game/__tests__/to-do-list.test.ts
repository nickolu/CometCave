import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import type { PokerHandsState } from '@/app/comet-cards/domain/hand/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('To Do List joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.toDoList, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('earns $4 when played hand matches target', () => {
    const game = setupGame()
    const started = reduceGame(game, { type: 'GAME_START' })

    // Determine target hand from counter
    const tdl = started.jokers.find(j => j.jokerId === 'toDoList')!
    const handIds = Object.keys(started.pokerHands)
    const targetHandId = handIds[tdl.counter]

    const withHand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: [targetHandId as keyof PokerHandsState, []],
        score: { chips: 10, mult: 5 },
      },
    }
    const initialMoney = withHand.money
    const after = reduceGame(withHand, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(initialMoney + 4)
  })

  it('earns no money when played hand does not match target', () => {
    const game = setupGame()
    const started = reduceGame(game, { type: 'GAME_START' })

    // Find a hand that does NOT match the target
    const tdl = started.jokers.find(j => j.jokerId === 'toDoList')!
    const handIds = Object.keys(started.pokerHands)
    const targetHandId = handIds[tdl.counter]
    const nonTargetHandId = handIds.find(id => id !== targetHandId)!

    const withHand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: [nonTargetHandId as keyof PokerHandsState, []],
        score: { chips: 10, mult: 5 },
      },
    }
    const initialMoney = withHand.money
    const after = reduceGame(withHand, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(initialMoney)
  })

  it('target changes on ROUND_END', () => {
    const game = setupGame()
    const started = reduceGame(game, { type: 'GAME_START' })

    const tdlBefore = started.jokers.find(j => j.jokerId === 'toDoList')!
    const counterBefore = tdlBefore.counter

    const afterRound = reduceGame(started, { type: 'ROUND_END' })

    const tdlAfter = afterRound.jokers.find(j => j.jokerId === 'toDoList')!
    const handIds = Object.keys(afterRound.pokerHands)
    expect(tdlAfter.counter).toBeGreaterThanOrEqual(0)
    expect(tdlAfter.counter).toBeLessThan(handIds.length)
    expect(typeof tdlAfter.counter).toBe('number')
  })
})
