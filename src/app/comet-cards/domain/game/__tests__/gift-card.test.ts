import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Gift Card joker', () => {
  it('adds $1 bonusSellValue to all jokers at ROUND_END', () => {
    const started = startRunWithJokers([jokers.giftCard, jokers.egg])

    const afterRound = reduceGame(started, { type: 'ROUND_END' })

    const giftCardInstance = afterRound.jokers.find(j => j.jokerId === 'giftCard')
    const eggInstance = afterRound.jokers.find(j => j.jokerId === 'egg')

    expect(giftCardInstance?.bonusSellValue).toBe(1)
    expect(eggInstance?.bonusSellValue).toBe(3 + 1) // egg gains 3, gift card adds 1
  })

  it('accumulates bonusSellValue over multiple rounds', () => {
    const started = startRunWithJokers([jokers.giftCard])

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const giftCardInstance = state.jokers.find(j => j.jokerId === 'giftCard')
    expect(giftCardInstance?.bonusSellValue).toBe(3)
  })

  it('adds bonusSellValue to sell price when sold', () => {
    const started = startRunWithJokers([jokers.giftCard])

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const giftCardInstance = state.jokers.find(j => j.jokerId === 'giftCard')!
    const moneyBeforeSale = state.money
    const selected = {
      ...state,
      gamePlayState: { ...state.gamePlayState, selectedJokerId: giftCardInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    // Gift Card price is $6, sell = floor(6/2)=3, bonusSellValue after 2 rounds is $2, total = $5
    expect(afterSale.money).toBe(moneyBeforeSale + Math.floor(jokers.giftCard.price / 2) + 2)
    expect(afterSale.jokers.some(j => j.jokerId === 'giftCard')).toBe(false)
  })
})
