import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Vampire joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.vampire, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('increments counter and removes enchantment when enchanted card is scored', () => {
    const game = setupGame()
    const vampireJoker = game.jokers.find(j => j.jokerId === 'vampire')!
    vampireJoker.counter = 10

    // Get any card and give it an enchantment
    const cardId = Object.keys(game.cards)[0]
    game.cards[cardId].flags.enchantment = 'bonus'
    game.gamePlayState.cardsToScore = [game.cards[cardId]]

    const after = reduceGame(game, { type: 'CARD_SCORED' })

    const vampireAfter = after.jokers.find(j => j.jokerId === 'vampire')!
    expect(vampireAfter.counter).toBe(11)
    expect(after.cards[cardId].flags.enchantment).toBe('none')
  })

  it('does not increment counter for non-enchanted cards', () => {
    const game = setupGame()
    const vampireJoker = game.jokers.find(j => j.jokerId === 'vampire')!
    vampireJoker.counter = 10

    const cardId = Object.keys(game.cards)[0]
    game.cards[cardId].flags.enchantment = 'none'
    game.gamePlayState.cardsToScore = [game.cards[cardId]]

    const after = reduceGame(game, { type: 'CARD_SCORED' })

    const vampireAfter = after.jokers.find(j => j.jokerId === 'vampire')!
    expect(vampireAfter.counter).toBe(10)
    expect(after.cards[cardId].flags.enchantment).toBe('none')
  })

  it('applies X Mult on HAND_SCORING_FINALIZE when counter > 10', () => {
    const game = setupGame()
    const vampireJoker = game.jokers.find(j => j.jokerId === 'vampire')!
    // 3 enhanced cards scored => counter = 10 + 3 = 13 => X1.3
    vampireJoker.counter = 13

    game.gamePlayState.score = { chips: 0, mult: 1 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Vampire' && 'operator' in e && e.operator === 'x' && 'value' in e && Math.abs((e.value as number) - 1.3) < 0.0001
    )).toBe(true)
  })

  it('does not apply X Mult on HAND_SCORING_FINALIZE when counter is exactly 10', () => {
    const game = setupGame()
    const vampireJoker = game.jokers.find(j => j.jokerId === 'vampire')!
    vampireJoker.counter = 10

    game.gamePlayState.score = { chips: 0, mult: 1 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Vampire'
    )).toBe(false)
  })

  it('initializes counter to 10 on first HAND_SCORING_FINALIZE if counter is 0', () => {
    const game = setupGame()
    const vampireJoker = game.jokers.find(j => j.jokerId === 'vampire')!
    expect(vampireJoker.counter).toBe(0)

    game.gamePlayState.score = { chips: 0, mult: 1 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    // counter initialized to 10 (X1.0), which is not > 10, so no scoring event
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Vampire'
    )).toBe(false)
  })
})
