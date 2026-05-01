import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Vagabond joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.vagabond, game)]
    game.gamePhase = 'gameplay'
    game.rounds = game.rounds.map((r, i) =>
      i === game.roundIndex
        ? { ...r, smallBlind: { ...r.smallBlind, status: 'inProgress' } }
        : r
    )
    game.gamePlayState = {
      ...game.gamePlayState,
      selectedHand: ['pair', []],
      score: { chips: 4, mult: 4 },
    }
    return { ...game, ...overrides }
  }

  it('creates a Tarot card when money is $4 or less', () => {
    const game = setupGame({ money: 4 })
    const before = game.consumables.length
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.consumables.length).toBe(before + 1)
    expect(after.consumables[after.consumables.length - 1].consumableType).toBe('tarotCard')
  })

  it('creates a Tarot card when money is $0', () => {
    const game = setupGame({ money: 0 })
    const before = game.consumables.length
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.consumables.length).toBe(before + 1)
    expect(after.consumables[after.consumables.length - 1].consumableType).toBe('tarotCard')
  })

  it('does not create a Tarot card when money is $5', () => {
    const game = setupGame({ money: 5 })
    const before = game.consumables.length
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.consumables.length).toBe(before)
  })

  it('does not create a Tarot card when money is greater than $4', () => {
    const game = setupGame({ money: 10 })
    const before = game.consumables.length
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.consumables.length).toBe(before)
  })

  it('does not create a Tarot card when consumables are full', () => {
    const game = setupGame({ money: 3 })
    game.consumables = Array.from({ length: game.maxConsumables }, (_, i) => ({
      id: `tarot-${i}`,
      consumableType: 'tarotCard' as const,
      name: 'The Fool',
      isFaceUp: true,
      tarotType: 'theFool' as const,
    }))
    const before = game.consumables.length
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.consumables.length).toBe(before)
  })
})
