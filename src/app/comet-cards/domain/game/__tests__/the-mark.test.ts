import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('The Mark boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Mark'
    return game
  }

  it('flips face cards face down on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()

    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!
    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    // Ensure both cards start face up
    game.cards[jackId] = { ...game.cards[jackId], isFaceUp: true }
    game.cards[aceId] = { ...game.cards[aceId], isFaceUp: true }

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.cards[jackId].isFaceUp).toBe(false)
    expect(after.cards[aceId].isFaceUp).toBe(true)
  })

  it('flips all J, Q, K cards face down on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()

    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!
    const queenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'Q'
    )!
    const kingId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    )!

    game.cards[jackId] = { ...game.cards[jackId], isFaceUp: true }
    game.cards[queenId] = { ...game.cards[queenId], isFaceUp: true }
    game.cards[kingId] = { ...game.cards[kingId], isFaceUp: true }

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.cards[jackId].isFaceUp).toBe(false)
    expect(after.cards[queenId].isFaceUp).toBe(false)
    expect(after.cards[kingId].isFaceUp).toBe(false)
  })

  it('does not flip non-face cards', () => {
    const game = setupGame()

    const twoId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '2'
    )!
    const tenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '10'
    )!

    game.cards[twoId] = { ...game.cards[twoId], isFaceUp: true }
    game.cards[tenId] = { ...game.cards[tenId], isFaceUp: true }

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.cards[twoId].isFaceUp).toBe(true)
    expect(after.cards[tenId].isFaceUp).toBe(true)
  })
})
