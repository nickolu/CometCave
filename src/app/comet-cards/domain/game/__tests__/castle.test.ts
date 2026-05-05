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

describe('Castle joker', () => {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades']

  function makeGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.castle, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  function getTargetSuit(game: GameState): string {
    const seed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      'castle',
      'suit',
    ])
    const roll = getRandomNumbersWithSeed({ seed, min: 0, max: 3, numberOfNumbers: 1 })
    return suits[roll[0]]
  }

  function getCardIdsBySuit(game: GameState, suit: string): string[] {
    return Object.keys(game.cards).filter(
      id => playingCards[game.cards[id].playingCardId]?.suit === suit
    )
  }

  it('counter increases by 3 per matching suit card discarded', () => {
    const game = makeGame()
    const targetSuit = getTargetSuit(game)
    const matchingIds = getCardIdsBySuit(game, targetSuit)

    expect(matchingIds.length).toBeGreaterThanOrEqual(1)

    const selectedIds = matchingIds.slice(0, Math.min(2, matchingIds.length))
    game.gamePlayState.selectedCardIds = selectedIds

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const c = after.jokers.find(j => j.jokerId === 'castle')
    expect(c?.counter).toBe(3 * selectedIds.length)
  })

  it('non-matching suit cards do not increase counter', () => {
    const game = makeGame()
    const targetSuit = getTargetSuit(game)

    const nonMatchingIds = Object.keys(game.cards).filter(id => {
      const cardDef = playingCards[game.cards[id].playingCardId]
      return cardDef?.suit !== targetSuit
    })

    expect(nonMatchingIds.length).toBeGreaterThanOrEqual(1)

    game.gamePlayState.selectedCardIds = [nonMatchingIds[0]]

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const c = after.jokers.find(j => j.jokerId === 'castle')
    expect(c?.counter).toBe(0)
  })

  it('accumulated chips apply on HAND_SCORING_FINALIZE', () => {
    const game = makeGame()
    const targetSuit = getTargetSuit(game)
    const matchingIds = getCardIdsBySuit(game, targetSuit)

    expect(matchingIds.length).toBeGreaterThanOrEqual(1)

    // First discard two matching cards to accumulate counter
    const selectedIds = matchingIds.slice(0, Math.min(2, matchingIds.length))
    game.gamePlayState.selectedCardIds = selectedIds

    const afterDiscard = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const c = afterDiscard.jokers.find(j => j.jokerId === 'castle')
    const expectedCounter = 3 * selectedIds.length
    expect(c?.counter).toBe(expectedCounter)

    // Now finalize scoring and verify accumulated chips are applied
    const hand: GameState = {
      ...afterDiscard,
      gamePlayState: {
        ...afterDiscard.gamePlayState,
        scoringEvents: [],
        score: { chips: 0, mult: 1 },
      },
    }
    const afterScoring = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScoring.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Castle' && 'value' in e && e.value === expectedCounter
    )).toBe(true)
  })
})
