import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Midas Mask joker', () => {
  function createGameWithMidasMask(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.midasMaskJoker, game)]
    return game
  }

  function withInProgressBlind(game: GameState): GameState {
    const round = game.rounds[game.roundIndex]
    return {
      ...game,
      rounds: game.rounds.map((r, i) =>
        i === game.roundIndex
          ? {
              ...r,
              smallBlind: { ...r.smallBlind, status: 'inProgress' },
            }
          : r
      ),
    }
  }

  function findCardByValue(game: GameState, value: string): string | undefined {
    return Object.keys(game.cards).find(id => {
      const card = game.cards[id]
      return playingCards[card.playingCardId]?.value === value
    })
  }

  it('converts face cards to Gold when scored', () => {
    const game = createGameWithMidasMask()
    const started = reduceGame(game, { type: 'GAME_START' })
    const withBlind = withInProgressBlind(started)

    // Find a Jack in the cards
    const jackId = findCardByValue(withBlind, 'J')
    expect(jackId).toBeTruthy()

    // Verify it's not Gold initially
    expect(withBlind.cards[jackId!].flags.enchantment).not.toBe('gold')

    // Set up the game so the Jack is in cardsToScore
    const withScoring: GameState = {
      ...withBlind,
      gamePlayState: {
        ...withBlind.gamePlayState,
        cardsToScore: [withBlind.cards[jackId!]],
      },
    }

    const afterScore = reduceGame(withScoring, { type: 'CARD_SCORED' })

    expect(afterScore.cards[jackId!].flags.enchantment).toBe('gold')
  })

  it('does not convert non-face cards', () => {
    const game = createGameWithMidasMask()
    const started = reduceGame(game, { type: 'GAME_START' })
    const withBlind = withInProgressBlind(started)

    // Find a number card (e.g., '5')
    const fiveId = findCardByValue(withBlind, '5')
    expect(fiveId).toBeTruthy()

    const withScoring: GameState = {
      ...withBlind,
      gamePlayState: {
        ...withBlind.gamePlayState,
        cardsToScore: [withBlind.cards[fiveId!]],
      },
    }

    const afterScore = reduceGame(withScoring, { type: 'CARD_SCORED' })

    expect(afterScore.cards[fiveId!].flags.enchantment).not.toBe('gold')
  })
})
