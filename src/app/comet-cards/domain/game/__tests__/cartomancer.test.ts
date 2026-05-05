import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Cartomancer joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cartomancer, game)]
    game.consumables = []
    return { ...game, ...overrides }
  }

  it('creates a Tarot card when SMALL_BLIND_SELECTED and consumables has room', () => {
    const game = setupGame()
    expect(game.consumables.length).toBe(0)
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('creates a Tarot card when BIG_BLIND_SELECTED and consumables has room', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })
    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('creates a Tarot card when BOSS_BLIND_SELECTED and consumables has room', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('does not create a Tarot card when consumables are full', () => {
    const game = setupGame({ maxConsumables: 2 })
    // Fill consumables to capacity
    const before = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    // Now fill the remaining slot manually by triggering again with full consumables
    const fullGame: GameState = { ...before, maxConsumables: before.consumables.length }
    const after = reduceGame(fullGame, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.consumables.length).toBe(fullGame.consumables.length)
  })
})
