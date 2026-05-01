import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Egg joker', () => {
  it('increases bonusSellValue by 3 on ROUND_END', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.egg, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    const eggInstance = afterRound.jokers.find(j => j.jokerId === 'egg')
    expect(eggInstance?.bonusSellValue).toBe(3)
  })

  it('accumulates bonusSellValue over multiple rounds', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.egg, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const eggInstance = state.jokers.find(j => j.jokerId === 'egg')
    expect(eggInstance?.bonusSellValue).toBe(6)
  })

  it('adds bonusSellValue to sell price when sold', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.egg, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const eggInstance = state.jokers.find(j => j.jokerId === 'egg')!
    const moneyBeforeSale = state.money
    const selected = {
      ...state,
      gamePlayState: { ...state.gamePlayState, selectedJokerId: eggInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    // Egg price is $4, bonusSellValue after 2 rounds is $6, total = $10
    expect(afterSale.money).toBe(moneyBeforeSale + jokers.egg.price + 6)
    expect(afterSale.jokers.some(j => j.jokerId === 'egg')).toBe(false)
  })
})
