import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Turtle Bean joker', () => {
  function createGameWithTurtleBean(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    const tb = initializeJoker(jokers.turtleBeanJoker, game)
    tb.metadata = { handSizeBonus: 5 }
    game.jokers = [tb]
    return game
  }

  it('adds +5 hand size modifier on GAME_START', () => {
    const game = createGameWithTurtleBean()
    expect(game.handSizeModifier).toBe(0)

    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.handSizeModifier).toBe(5)
  })

  it('reduces hand size modifier by 1 on ROUND_END', () => {
    const game = createGameWithTurtleBean()
    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.handSizeModifier).toBe(5)

    const afterRound1 = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound1.handSizeModifier).toBe(4)
    const tb1 = afterRound1.jokers.find(j => j.jokerId === 'turtleBeanJoker')
    expect(tb1).toBeTruthy()
    expect(tb1!.metadata?.handSizeBonus).toBe(4)
  })

  it('self-destructs after 5 rounds', () => {
    let game = createGameWithTurtleBean()
    game = reduceGame(game, { type: 'GAME_START' })

    for (let i = 0; i < 5; i++) {
      game = reduceGame(game, { type: 'ROUND_END' })
    }

    expect(game.handSizeModifier).toBe(0)
    expect(game.jokers.some(j => j.jokerId === 'turtleBeanJoker')).toBe(false)
  })

  it('reverts hand size modifier when sold', () => {
    const game = createGameWithTurtleBean()
    const started = reduceGame(game, { type: 'GAME_START' })
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
