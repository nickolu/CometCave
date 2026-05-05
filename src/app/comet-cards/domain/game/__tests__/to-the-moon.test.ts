import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { calculateInterest } from '@/app/comet-cards/domain/game/utils'

describe('To the Moon joker', () => {
  function createGameWithToTheMoon(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.toTheMoonJoker, game)]
    return game
  }

  it('increases maxInterest on GAME_START', () => {
    const game = createGameWithToTheMoon()
    expect(game.maxInterest).toBe(5)

    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.maxInterest).toBe(105)
  })

  it('allows interest beyond normal cap with $30', () => {
    const game = createGameWithToTheMoon()
    const started = reduceGame(game, { type: 'GAME_START' })
    const withMoney = { ...started, money: 30 }

    const interest = calculateInterest(withMoney)
    expect(interest).toBe(6) // floor(30/5) = 6, normally capped at 5
  })

  it('allows high interest with $50', () => {
    const game = createGameWithToTheMoon()
    const started = reduceGame(game, { type: 'GAME_START' })
    const withMoney = { ...started, money: 50 }

    const interest = calculateInterest(withMoney)
    expect(interest).toBe(10) // floor(50/5) = 10
  })

  it('reverts maxInterest when sold', () => {
    const game = createGameWithToTheMoon()
    const started = reduceGame(game, { type: 'GAME_START' })
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
