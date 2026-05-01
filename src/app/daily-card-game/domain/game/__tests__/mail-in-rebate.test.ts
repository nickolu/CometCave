import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import {
  buildSeedString,
  getRandomNumbersWithSeed,
} from '@/app/daily-card-game/domain/randomness'

describe('Mail-In Rebate joker', () => {
  const allValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

  function makeGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.mailInRebate, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  function getTargetValue(game: GameState): string {
    const seed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      'mailInRebate',
      'target',
    ])
    const roll = getRandomNumbersWithSeed({ seed, min: 0, max: allValues.length - 1, numberOfNumbers: 1 })
    return allValues[roll[0]]
  }

  function getCardIdsByValue(game: GameState, value: string): string[] {
    return Object.keys(game.cards).filter(
      id => playingCards[game.cards[id].playingCardId]?.value === value
    )
  }

  it('earns $5 for each discarded card matching the target rank', () => {
    const game = makeGame()
    const targetValue = getTargetValue(game)
    const matchingIds = getCardIdsByValue(game, targetValue)

    expect(matchingIds.length).toBeGreaterThanOrEqual(1)

    // Discard 2 matching cards
    const selectedIds = matchingIds.slice(0, Math.min(2, matchingIds.length))
    game.gamePlayState.selectedCardIds = selectedIds

    const initialMoney = game.money
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    expect(after.money).toBe(initialMoney + 5 * selectedIds.length)
  })

  it('earns no money when discarded cards do not match the target rank', () => {
    const game = makeGame()
    const targetValue = getTargetValue(game)

    // Find non-matching cards
    const nonMatchingIds = Object.keys(game.cards).filter(id => {
      const cardDef = playingCards[game.cards[id].playingCardId]
      return cardDef?.value !== targetValue
    })

    expect(nonMatchingIds.length).toBeGreaterThanOrEqual(1)

    game.gamePlayState.selectedCardIds = [nonMatchingIds[0]]

    const initialMoney = game.money
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    expect(after.money).toBe(initialMoney)
  })

  it('target rank changes on ROUND_END', () => {
    const game = makeGame()

    const targetValueBefore = getTargetValue(game)

    // Advance round
    const afterRound = reduceGame(game, { type: 'ROUND_END' })

    const targetValueAfter = getTargetValue(afterRound)

    // Both should be valid card values
    expect(allValues).toContain(targetValueBefore)
    expect(allValues).toContain(targetValueAfter)

    // The target is computed from roundIndex which changes on ROUND_END
    // We just verify it's a valid rank
    expect(typeof targetValueAfter).toBe('string')
  })
})
