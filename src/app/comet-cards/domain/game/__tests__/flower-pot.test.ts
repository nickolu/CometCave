import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Flower Pot joker', () => {
  it('applies X3 Mult with all 4 suits', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.flowerPotJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Find one card of each suit
    const suits = ['diamonds', 'clubs', 'hearts', 'spades'] as const
    const cards = suits.map(suit => {
      const id = Object.keys(game.cards).find(id =>
        playingCards[game.cards[id].playingCardId]?.suit === suit
      )!
      return game.cards[id]
    })
    game.gamePlayState.selectedHand = ['flush', cards]
    game.gamePlayState.score = { chips: 10, mult: 5 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Flower Pot' && 'operator' in e && e.operator === 'x' && e.value === 3
    )).toBe(true)
  })

  it('does not apply with only 3 suits', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.flowerPotJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const suits = ['diamonds', 'clubs', 'hearts'] as const
    const cards = suits.map(suit => {
      const id = Object.keys(game.cards).find(id =>
        playingCards[game.cards[id].playingCardId]?.suit === suit
      )!
      return game.cards[id]
    })
    game.gamePlayState.selectedHand = ['highCard', cards]
    game.gamePlayState.score = { chips: 10, mult: 5 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Flower Pot'
    )).toBe(false)
  })
})
