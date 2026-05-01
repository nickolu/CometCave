import { describe, expect, it } from 'vitest'
import { createGameStateWithDeck } from '@/app/daily-card-game/domain/game/default-game-state'

describe('Blue Deck', () => {
  it('gives maxHands = default + 1', () => {
    const game = createGameStateWithDeck('blueDeck')
    expect(game.maxHands).toBe(5)
  })

  it('gives remainingHands = default + 1 at game start', () => {
    const game = createGameStateWithDeck('blueDeck')
    expect(game.gamePlayState.remainingHands).toBe(5)
  })
})
