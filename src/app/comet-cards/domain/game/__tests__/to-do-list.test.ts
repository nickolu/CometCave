import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import type { PokerHandsState } from '@/app/comet-cards/domain/hand/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('To Do List joker', () => {
  function setupGame(): GameState {
    return inGameplay(startRunWithJokers([jokers.toDoList]))
  }

  function targetHandId(game: GameState): string {
    const tdl = game.jokers.find(j => j.jokerId === 'toDoList')!
    return Object.keys(game.pokerHands)[tdl.counter]
  }

  function playHand(game: GameState, handId: string): GameState {
    return reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          selectedHand: [handId as keyof PokerHandsState, []],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('earns $4 when played hand matches target', () => {
    const started = setupGame()

    const after = playHand(started, targetHandId(started))
    expect(after.money).toBe(started.money + 4)
  })

  it('earns no money when played hand does not match target', () => {
    const started = setupGame()

    // Find a hand that does NOT match the target
    const target = targetHandId(started)
    const nonTargetHandId = Object.keys(started.pokerHands).find(id => id !== target)!

    const after = playHand(started, nonTargetHandId)
    expect(after.money).toBe(started.money)

    // Control: the target hand from the same state does pay, so the flat
    // balance above is the hand missing rather than the joker doing nothing.
    expect(playHand(after, target).money).toBe(after.money + 4)
  })

  it('rolls a fresh target on ROUND_END', () => {
    const started = setupGame()

    // Park the target on a value the joker could never roll, so the end of the
    // round has to overwrite it rather than simply leaving it alone.
    const parked: GameState = {
      ...started,
      jokers: started.jokers.map(j =>
        j.jokerId === 'toDoList' ? { ...j, counter: 999 } : j
      ),
    }

    const afterRound = reduceGame(parked, { type: 'ROUND_END' })

    const tdlAfter = afterRound.jokers.find(j => j.jokerId === 'toDoList')!
    const handIds = Object.keys(afterRound.pokerHands)
    expect(tdlAfter.counter).toBeGreaterThanOrEqual(0)
    expect(tdlAfter.counter).toBeLessThan(handIds.length)
  })
})
