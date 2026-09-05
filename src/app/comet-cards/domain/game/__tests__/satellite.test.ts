import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Satellite joker', () => {
  function runWithConsumablesUsed(used: GameState['consumablesUsed']): GameState {
    return { ...startRunWithJokers([jokers.satellite]), consumablesUsed: used }
  }

  it('earns $1 per unique Planet card used at ROUND_END', () => {
    const started = runWithConsumablesUsed([
      { id: '1', consumableType: 'celestialCard', handId: 'highCard' },
      { id: '2', consumableType: 'celestialCard', handId: 'pair' },
      { id: '3', consumableType: 'celestialCard', handId: 'twoPair' },
    ])
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(started.money + 3)
  })

  it('earns $0 when no Planet cards used', () => {
    const started = runWithConsumablesUsed([])
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.jokers.some(j => j.jokerId === 'satellite')).toBe(true)
    expect(afterRound.money).toBe(started.money)
  })

  it('counts duplicate Planet cards only once', () => {
    const started = runWithConsumablesUsed([
      { id: '1', consumableType: 'celestialCard', handId: 'pair' },
      { id: '2', consumableType: 'celestialCard', handId: 'pair' },
      { id: '3', consumableType: 'celestialCard', handId: 'pair' },
    ])
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(started.money + 1)
  })

  it('ignores Tarot cards when counting', () => {
    const started = runWithConsumablesUsed([
      { id: '1', consumableType: 'celestialCard', handId: 'flush' },
      { id: '2', consumableType: 'tarotCard', tarotType: 'theFool' } as never,
    ])
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(started.money + 1)
  })
})
