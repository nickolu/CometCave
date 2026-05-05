import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Riff-Raff joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.riffRaff, game)]
    return { ...game, ...overrides }
  }

  it('creates 2 common jokers when SMALL_BLIND_SELECTED and 2+ slots available', () => {
    const game = setupGame()
    // 1 joker (riff-raff itself), maxJokers is 5, so 4 slots available
    expect(game.jokers.length).toBe(1)
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.jokers.length).toBe(3)
    // The 2 new jokers should be common
    const newJokers = after.jokers.slice(1)
    for (const j of newJokers) {
      const def = Object.values(jokers).find(d => d.id === j.jokerId)
      expect(def?.rarity).toBe('common')
    }
  })

  it('creates 2 common jokers when BIG_BLIND_SELECTED and 2+ slots available', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })
    expect(after.jokers.length).toBe(3)
  })

  it('creates 2 common jokers when BOSS_BLIND_SELECTED and 2+ slots available', () => {
    const game = setupGame()
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.jokers.length).toBe(3)
  })

  it('creates only 1 joker if only 1 slot available', () => {
    const game = setupGame({ maxJokers: 2 })
    // 1 riff-raff + maxJokers=2 → 1 slot available
    expect(game.jokers.length).toBe(1)
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.jokers.length).toBe(2)
  })

  it('creates 0 jokers if no slots available', () => {
    const game = setupGame({ maxJokers: 1 })
    // 1 riff-raff + maxJokers=1 → 0 slots available
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.jokers.length).toBe(1)
  })
})
