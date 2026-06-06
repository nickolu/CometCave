import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('restart (GAME_START from mid-run)', () => {
  it('resets gamePhase to blindSelection', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.gamePhase = 'shop'
    const after = reduceGame(game, { type: 'GAME_START' })
    expect(after.gamePhase).toBe('blindSelection')
  })

  it('resets roundIndex to 1', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.roundIndex = 3
    const after = reduceGame(game, { type: 'GAME_START' })
    expect(after.roundIndex).toBe(1)
  })

  it('resets money to 0', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.money = 100
    const after = reduceGame(game, { type: 'GAME_START' })
    expect(after.money).toBe(0)
  })

  it('resets jokers to empty', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      initializeJoker(jokers.jokerJoker, game),
      initializeJoker(jokers.halfJoker, game),
    ]
    const after = reduceGame(game, { type: 'GAME_START' })
    expect(after.jokers).toHaveLength(0)
  })

  it('preserves selectedDeck', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.selectedDeck = 'abandonedDeck'
    const after = reduceGame(game, { type: 'GAME_START' })
    expect(after.selectedDeck).toBe('abandonedDeck')
  })
})
