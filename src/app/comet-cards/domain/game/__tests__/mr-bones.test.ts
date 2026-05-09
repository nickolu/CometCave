import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Mr. Bones joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.mrBones, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('prevents game over when score >= 25% of ante and destroys itself', () => {
    const game = setupGame()
    game.gamePlayState.remainingHands = 0
    // Ante is 300 for default roundIndex. 25% of 300 = 75.
    // chips*mult = 100 >= 75 → Mr. Bones should save
    game.gamePlayState.score = { chips: 10, mult: 10 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePhase).not.toBe('gameOver')
    expect(after.jokers.find(j => j.jokerId === 'mrBones')).toBeUndefined()
  })

  it('does not prevent game over when score < 25% of ante', () => {
    const game = setupGame()
    game.gamePlayState.remainingHands = 0
    // chips*mult = 1, ante = 300, 25% = 75, 1 < 75 → game over
    game.gamePlayState.score = { chips: 1, mult: 1 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePhase).toBe('gameOver')
    expect(after.jokers.find(j => j.jokerId === 'mrBones')).toBeDefined()
  })

  it('does nothing when blind is met (no need to save)', () => {
    const game = setupGame()
    game.gamePlayState.remainingHands = 0
    // chips*mult = 400 >= 300 (ante) → blind met, no save needed
    game.gamePlayState.score = { chips: 20, mult: 20 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePhase).toBe('blindRewards')
    expect(after.jokers.find(j => j.jokerId === 'mrBones')).toBeDefined()
  })
})
