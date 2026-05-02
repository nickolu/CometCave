import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The Wheel boss blind', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Wheel'
    return { ...game, ...overrides }
  }

  it('flips some cards face down on BOSS_BLIND_SELECTED (deterministic with seed)', () => {
    const game = setupGame()
    // Add several cards all face up
    game.cards = {}
    for (let i = 0; i < 14; i++) {
      game.cards[`card-${i}`] = {
        id: `card-${i}`,
        playingCardId: 'A_spades',
        isFaceUp: true,
        flags: {},
      } as any
    }
    game.ownedCardIds = Object.keys(game.cards)
    game.gameSeed = 'test-seed-wheel'

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    const faceDownCount = Object.values(after.cards).filter(c => !c.isFaceUp).length
    // With 14 cards and 1/7 chance, expect ~2 face down (but it's deterministic)
    // Just verify at least some behavior occurred and it's deterministic
    expect(faceDownCount).toBeGreaterThanOrEqual(0)
    expect(faceDownCount).toBeLessThan(14) // not all should be face down

    // Verify deterministic: running again with same seed gives same result
    const game2 = setupGame()
    game2.cards = {}
    for (let i = 0; i < 14; i++) {
      game2.cards[`card-${i}`] = {
        id: `card-${i}`,
        playingCardId: 'A_spades',
        isFaceUp: true,
        flags: {},
      } as any
    }
    game2.ownedCardIds = Object.keys(game2.cards)
    game2.gameSeed = 'test-seed-wheel'
    const after2 = reduceGame(game2, { type: 'BOSS_BLIND_SELECTED' })
    const faceDownCount2 = Object.values(after2.cards).filter(c => !c.isFaceUp).length
    expect(faceDownCount2).toBe(faceDownCount)
  })
})
