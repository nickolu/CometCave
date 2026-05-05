import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import {
  buildSeedString,
  getRandomNumbersWithSeed,
} from '@/app/comet-cards/domain/randomness'

describe('Ancient Joker', () => {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades']

  function makeGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.ancientJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  function getTargetSuit(game: GameState): string {
    const seed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      'ancientJoker',
      'suit',
    ])
    const roll = getRandomNumbersWithSeed({ seed, min: 0, max: 3, numberOfNumbers: 1 })
    return suits[roll[0]]
  }

  it('gives X1.5 Mult when a card of the target suit is scored', () => {
    const game = makeGame()
    const targetSuit = getTargetSuit(game)

    const matchingCardId = Object.keys(game.cards).find(
      id => playingCards[game.cards[id].playingCardId]?.suit === targetSuit
    )!

    expect(matchingCardId).toBeDefined()

    const card = game.cards[matchingCardId]
    const multBefore = game.gamePlayState.score.mult

    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ancient Joker' && 'operator' in e && e.operator === 'x' && e.value === 1.5
    )).toBe(true)
    expect(after.gamePlayState.score.mult).toBe(multBefore * 1.5)
  })

  it('gives no bonus when a card of a non-matching suit is scored', () => {
    const game = makeGame()
    const targetSuit = getTargetSuit(game)

    const nonMatchingCardId = Object.keys(game.cards).find(
      id => playingCards[game.cards[id].playingCardId]?.suit !== targetSuit
    )!

    expect(nonMatchingCardId).toBeDefined()

    const card = game.cards[nonMatchingCardId]
    const multBefore = game.gamePlayState.score.mult

    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ancient Joker'
    )).toBe(false)
    expect(after.gamePlayState.score.mult).toBe(multBefore)
  })
})
