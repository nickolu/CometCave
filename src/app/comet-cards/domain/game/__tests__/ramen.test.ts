import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Ramen joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.ramen, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('applies X2 Mult on HAND_SCORING_FINALIZE (counter=200)', () => {
    const game = setupGame()
    const ramenJoker = game.jokers.find(j => j.jokerId === 'ramen')!
    ramenJoker.counter = 200

    game.gamePlayState.score = { chips: 0, mult: 1 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ramen' && 'value' in e && e.value === 2 && 'operator' in e && e.operator === 'x'
    )).toBe(true)
  })

  it('counter decreases by number of cards discarded', () => {
    const game = setupGame()
    const ramenJoker = game.jokers.find(j => j.jokerId === 'ramen')!
    ramenJoker.counter = 200

    const cardIds = Object.keys(game.cards)
    game.gamePlayState.selectedCardIds = [cardIds[0], cardIds[1], cardIds[2]]

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const ramenAfter = after.jokers.find(j => j.jokerId === 'ramen')
    // Discarded 3 cards, counter should go from 200 to 197
    // But 197 > 100, so it should still be present
    expect(ramenAfter).toBeDefined()
    expect(ramenAfter?.counter).toBe(197)
  })

  it('self-destructs when counter drops to 100 or below', () => {
    const game = setupGame()
    const ramenJoker = game.jokers.find(j => j.jokerId === 'ramen')!
    // Set counter so that discarding 5 cards drops it to exactly 100
    ramenJoker.counter = 105

    const cardIds = Object.keys(game.cards)
    game.gamePlayState.selectedCardIds = cardIds.slice(0, 5)

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const ramenAfter = after.jokers.find(j => j.jokerId === 'ramen')
    expect(ramenAfter).toBeUndefined()
  })

  it('self-destructs when counter drops below 100', () => {
    const game = setupGame()
    const ramenJoker = game.jokers.find(j => j.jokerId === 'ramen')!
    // Set counter so discarding 5 cards drops it below 100
    ramenJoker.counter = 103

    const cardIds = Object.keys(game.cards)
    game.gamePlayState.selectedCardIds = cardIds.slice(0, 5)

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const ramenAfter = after.jokers.find(j => j.jokerId === 'ramen')
    expect(ramenAfter).toBeUndefined()
  })

  it('initializes counter to 200 on first HAND_SCORING_FINALIZE if counter is 0', () => {
    const game = setupGame()
    const ramenJoker = game.jokers.find(j => j.jokerId === 'ramen')!
    expect(ramenJoker.counter).toBe(0)

    game.gamePlayState.score = { chips: 0, mult: 1 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    // After scoring, counter should be 200 (initialized) and X2 mult applied
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ramen' && 'value' in e && e.value === 2
    )).toBe(true)
  })

  it('initializes counter to 200 on first DISCARD_SELECTED_CARDS if counter is 0', () => {
    const game = setupGame()
    const ramenJoker = game.jokers.find(j => j.jokerId === 'ramen')!
    expect(ramenJoker.counter).toBe(0)

    const cardIds = Object.keys(game.cards)
    game.gamePlayState.selectedCardIds = [cardIds[0]]

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const ramenAfter = after.jokers.find(j => j.jokerId === 'ramen')
    // counter initialized to 200, then 1 card discarded -> 199
    expect(ramenAfter).toBeDefined()
    expect(ramenAfter?.counter).toBe(199)
  })
})
