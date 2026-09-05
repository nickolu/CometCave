import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRun, startRunWithJokers } from './helpers/start-run'

describe('Turtle Bean joker', () => {
  function createGameWithTurtleBean(): GameState {
    return startRunWithJokers([jokers.turtleBeanJoker])
  }

  it('adds +5 hand size modifier when acquired', () => {
    expect(startRun().handSizeModifier).toBe(0)

    expect(createGameWithTurtleBean().handSizeModifier).toBe(5)
  })

  it('reduces hand size modifier by 1 on ROUND_END', () => {
    const started = createGameWithTurtleBean()
    expect(started.handSizeModifier).toBe(5)

    const afterRound1 = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound1.handSizeModifier).toBe(4)
    const tb1 = afterRound1.jokers.find(j => j.jokerId === 'turtleBeanJoker')
    expect(tb1).toBeTruthy()
    expect(tb1!.metadata?.handSizeBonus).toBe(4)
  })

  it('self-destructs after 5 rounds', () => {
    let game = createGameWithTurtleBean()

    for (let i = 0; i < 5; i++) {
      game = reduceGame(game, { type: 'ROUND_END' })
    }

    expect(game.handSizeModifier).toBe(0)
    expect(game.jokers.some(j => j.jokerId === 'turtleBeanJoker')).toBe(false)
  })

  it('decrements each instance independently with multiple Turtle Beans', () => {
    const started = startRunWithJokers([jokers.turtleBeanJoker, jokers.turtleBeanJoker])
    expect(started.handSizeModifier).toBe(10)

    const afterRound1 = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound1.handSizeModifier).toBe(8) // each decremented by 1
    expect(afterRound1.jokers.length).toBe(2)

    // After 5 rounds both should be gone
    let g = started
    for (let i = 0; i < 5; i++) {
      g = reduceGame(g, { type: 'ROUND_END' })
    }
    expect(g.handSizeModifier).toBe(0)
    expect(g.jokers.some(j => j.jokerId === 'turtleBeanJoker')).toBe(false)
  })

  it('reverts hand size modifier when sold', () => {
    const started = createGameWithTurtleBean()
    expect(started.handSizeModifier).toBe(5)

    // Sell after 2 rounds (bonus should be 3)
    let afterRounds = started
    afterRounds = reduceGame(afterRounds, { type: 'ROUND_END' })
    afterRounds = reduceGame(afterRounds, { type: 'ROUND_END' })
    expect(afterRounds.handSizeModifier).toBe(3)

    const tbInstance = afterRounds.jokers.find(j => j.jokerId === 'turtleBeanJoker')!
    const selected = {
      ...afterRounds,
      gamePlayState: { ...afterRounds.gamePlayState, selectedJokerId: tbInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.handSizeModifier).toBe(0)
    expect(afterSale.jokers.some(j => j.jokerId === 'turtleBeanJoker')).toBe(false)
  })
})
