import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { greedyJoker, lustyJoker, wrathfulJoker } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

const GREEDY_JOKER = greedyJoker
const LUSTY_JOKER = lustyJoker
const WRATHFUL_JOKER = wrathfulJoker

if (!GREEDY_JOKER || !LUSTY_JOKER || !WRATHFUL_JOKER) {
  throw new Error('Required joker definitions are missing for Amber Acorn tests')
}

describe('Amber Acorn boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.gameSeed = 'amber-acorn-seed'
    game.roundIndex = 8
    game.rounds[game.roundIndex].bossBlindName = 'Amber Acorn'
    game.jokers = [
      initializeJoker(GREEDY_JOKER, game),
      initializeJoker(LUSTY_JOKER, game),
      initializeJoker(WRATHFUL_JOKER, game),
    ]

    return { ...game, ...overrides }
  }

  it('flips all jokers face down when the boss blind is selected', () => {
    const game = setupGame()

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.jokers).toHaveLength(3)
    expect(after.jokers.every(joker => joker.isFaceUp === false)).toBe(true)
  })

  it('shuffles jokers deterministically when the boss blind is selected', () => {
    const game = setupGame()
    const beforeOrder = game.jokers.map(joker => joker.id)

    const after1 = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    const after2 = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    const afterOrder1 = after1.jokers.map(joker => joker.id)
    const afterOrder2 = after2.jokers.map(joker => joker.id)

    expect(afterOrder1).toEqual(afterOrder2)
    expect(afterOrder1).not.toEqual(beforeOrder)
  })

  it('does not flip or shuffle jokers for other boss blinds', () => {
    const game = setupGame()
    game.rounds[game.roundIndex].bossBlindName = 'The Ox'
    const beforeOrder = game.jokers.map(joker => joker.id)

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.jokers.map(joker => joker.id)).toEqual(beforeOrder)
    expect(after.jokers.every(joker => joker.isFaceUp)).toBe(true)
  })
})
