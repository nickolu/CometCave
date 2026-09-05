import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Midas Mask joker', () => {
  function createGameWithMidasMask(): GameState {
    return inGameplay(startRunWithJokers([jokers.midasMaskJoker]))
  }

  function findCardByValue(game: GameState, value: string): string | undefined {
    return Object.keys(game.cards).find(id => {
      const card = game.cards[id]
      return playingCards[card.playingCardId]?.value === value
    })
  }

  it('converts face cards to Gold when scored', () => {
    const withBlind = createGameWithMidasMask()

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
    const withBlind = createGameWithMidasMask()

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

    expect(afterScore.jokers.some(j => j.jokerId === 'midasMaskJoker')).toBe(true)
    expect(afterScore.cards[fiveId!].flags.enchantment).not.toBe('gold')
  })
})
