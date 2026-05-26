import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Ceremonial Dagger joker', () => {
  function setupGame(overrides: Partial<GameState> = {}): GameState {
    const game: GameState = structuredClone(defaultGameState)
    return { ...game, ...overrides }
  }

  it('destroys joker to the right and gains double its sell value as counter on SMALL_BLIND_SELECTED', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    const rightJoker = initializeJoker(jokers.jokerJoker, game)
    // jokerJoker price is 2, bonusSellValue is 0, so sell value = floor(2/2) = 1, double = 2
    game.jokers = [dagger, rightJoker]

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    // Right joker should be destroyed
    expect(after.jokers.length).toBe(1)
    expect(after.jokers[0].jokerId).toBe('ceremonialDagger')

    // Counter should be double the sell value (2 * 1 = 2)
    const daggerAfter = after.jokers.find(j => j.jokerId === 'ceremonialDagger')
    expect(daggerAfter?.counter).toBe(2)
  })

  it('destroys joker to the right and gains double its sell value on BIG_BLIND_SELECTED', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    const rightJoker = initializeJoker(jokers.jokerJoker, game)
    game.jokers = [dagger, rightJoker]

    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })

    expect(after.jokers.length).toBe(1)
    const daggerAfter = after.jokers.find(j => j.jokerId === 'ceremonialDagger')
    expect(daggerAfter?.counter).toBe(2)
  })

  it('destroys joker to the right and gains double its sell value on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    const rightJoker = initializeJoker(jokers.jokerJoker, game)
    game.jokers = [dagger, rightJoker]

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.jokers.length).toBe(1)
    const daggerAfter = after.jokers.find(j => j.jokerId === 'ceremonialDagger')
    expect(daggerAfter?.counter).toBe(2)
  })

  it('includes bonusSellValue in the sell value calculation', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    const rightJoker = initializeJoker(jokers.jokerJoker, game)
    rightJoker.bonusSellValue = 3
    // jokerJoker price is 2, bonusSellValue is 3, so sell value = floor(2/2)+3 = 4, double = 8
    game.jokers = [dagger, rightJoker]

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    const daggerAfter = after.jokers.find(j => j.jokerId === 'ceremonialDagger')
    expect(daggerAfter?.counter).toBe(8)
  })

  it('does nothing if no joker to the right', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    game.jokers = [dagger]

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    expect(after.jokers.length).toBe(1)
    const daggerAfter = after.jokers.find(j => j.jokerId === 'ceremonialDagger')
    expect(daggerAfter?.counter).toBe(0)
  })

  it('applies accumulated Mult on HAND_SCORING_FINALIZE', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    dagger.counter = 8
    game.jokers = [dagger]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const withHand: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }

    const after = reduceGame(withHand, { type: 'HAND_SCORING_FINALIZE' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ceremonial Dagger' && 'value' in e && e.value === 8
    )).toBe(true)
  })

  it('does not add Mult on HAND_SCORING_FINALIZE when counter is 0', () => {
    const game = setupGame()
    const dagger = initializeJoker(jokers.ceremonialDagger, game)
    dagger.counter = 0
    game.jokers = [dagger]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const withHand: GameState = {
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }

    const after = reduceGame(withHand, { type: 'HAND_SCORING_FINALIZE' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ceremonial Dagger'
    )).toBe(false)
  })
})
