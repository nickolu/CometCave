import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { calculateInterest } from '@/app/comet-cards/domain/game/utils'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRun, startRunWithJokers } from './helpers/start-run'

describe('To the Moon joker', () => {
  function createGameWithToTheMoon(): GameState {
    return startRunWithJokers([jokers.toTheMoonJoker])
  }

  it('increases maxInterest when acquired', () => {
    expect(startRun().maxInterest).toBe(5)

    expect(createGameWithToTheMoon().maxInterest).toBe(105)
  })

  it('allows interest beyond normal cap with $30', () => {
    const withMoney = { ...createGameWithToTheMoon(), money: 30 }

    const interest = calculateInterest(withMoney)
    expect(interest).toBe(6) // floor(30/5) = 6, normally capped at 5
  })

  it('allows high interest with $50', () => {
    const withMoney = { ...createGameWithToTheMoon(), money: 50 }

    const interest = calculateInterest(withMoney)
    expect(interest).toBe(10) // floor(50/5) = 10
  })

  it('reverts maxInterest when sold', () => {
    const started = createGameWithToTheMoon()
    expect(started.maxInterest).toBe(105)

    const jokerInstance = started.jokers.find(j => j.jokerId === 'toTheMoonJoker')!
    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: jokerInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.maxInterest).toBe(5)
    expect(afterSale.jokers.some(j => j.jokerId === 'toTheMoonJoker')).toBe(false)
  })
})
