import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Satellite joker', () => {
  it('earns $1 per unique Planet card used at ROUND_END', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.satellite, game)]
    game.consumablesUsed = [
      { id: '1', consumableType: 'celestialCard', handId: 'highCard' },
      { id: '2', consumableType: 'celestialCard', handId: 'pair' },
      { id: '3', consumableType: 'celestialCard', handId: 'twoPair' },
    ]
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 3)
  })

  it('earns $0 when no Planet cards used', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.satellite, game)]
    game.consumablesUsed = []
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney)
  })

  it('counts duplicate Planet cards only once', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.satellite, game)]
    game.consumablesUsed = [
      { id: '1', consumableType: 'celestialCard', handId: 'pair' },
      { id: '2', consumableType: 'celestialCard', handId: 'pair' },
      { id: '3', consumableType: 'celestialCard', handId: 'pair' },
    ]
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 1)
  })

  it('ignores Tarot cards when counting', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.satellite, game)]
    game.consumablesUsed = [
      { id: '1', consumableType: 'celestialCard', handId: 'flush' },
      { id: '2', consumableType: 'tarotCard', tarotType: 'theFool' } as any,
    ]
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 1)
  })
})
