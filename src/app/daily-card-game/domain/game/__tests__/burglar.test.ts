import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Burglar joker', () => {
  it('gains +3 maxHands when blind is selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.burglar, game)]
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.maxHands).toBe(defaultGameState.maxHands + 3)
    expect(after.gamePlayState.remainingHands).toBe(defaultGameState.gamePlayState.remainingHands + 3)
  })

  it('sets maxDiscards to 0 when blind is selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.burglar, game)]
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.maxDiscards).toBe(0)
    expect(after.gamePlayState.remainingDiscards).toBe(0)
  })
})
