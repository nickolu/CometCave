import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Egg joker', () => {
  it('increases bonusSellValue by 3 on ROUND_END', () => {
    const started = startRunWithJokers([jokers.egg])

    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    const eggInstance = afterRound.jokers.find(j => j.jokerId === 'egg')
    expect(eggInstance?.bonusSellValue).toBe(3)
  })

  it('accumulates bonusSellValue over multiple rounds', () => {
    const started = startRunWithJokers([jokers.egg])

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const eggInstance = state.jokers.find(j => j.jokerId === 'egg')
    expect(eggInstance?.bonusSellValue).toBe(6)
  })

  it('adds bonusSellValue to sell price when sold', () => {
    const started = startRunWithJokers([jokers.egg])

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const eggInstance = state.jokers.find(j => j.jokerId === 'egg')!
    const moneyBeforeSale = state.money
    const selected = {
      ...state,
      gamePlayState: { ...state.gamePlayState, selectedJokerId: eggInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    // Egg price is $4, sell = floor(4/2)=2, bonusSellValue after 2 rounds is $6, total = $8
    expect(afterSale.money).toBe(moneyBeforeSale + Math.floor(jokers.egg.price / 2) + 6)
    expect(afterSale.jokers.some(j => j.jokerId === 'egg')).toBe(false)
  })
})
