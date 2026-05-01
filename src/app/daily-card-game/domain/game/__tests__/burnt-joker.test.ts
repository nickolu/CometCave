import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Burnt Joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.burntJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('upgrades hand level on first discard of the round', () => {
    const game = setupGame()
    const cardIds = Object.keys(game.cards).slice(0, 2)
    game.gamePlayState.selectedCardIds = cardIds

    const pairLevelBefore = game.pokerHands.pair.level
    const highCardLevelBefore = game.pokerHands.highCard.level

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })

    // One poker hand level must have increased by 1
    const pairLevelAfter = after.pokerHands.pair.level
    const highCardLevelAfter = after.pokerHands.highCard.level
    const anyHandUpgraded =
      pairLevelAfter > pairLevelBefore || highCardLevelAfter > highCardLevelBefore

    expect(anyHandUpgraded).toBe(true)
  })

  it('sets counter to 1 after first discard', () => {
    const game = setupGame()
    const bj = game.jokers.find(j => j.jokerId === 'burntJoker')!
    expect(bj.counter).toBe(0)

    const cardIds = Object.keys(game.cards).slice(0, 1)
    game.gamePlayState.selectedCardIds = cardIds

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const bjAfter = after.jokers.find(j => j.jokerId === 'burntJoker')
    expect(bjAfter?.counter).toBe(1)
  })

  it('does not upgrade hand level on second discard of the round', () => {
    const game = setupGame()
    const bj = game.jokers.find(j => j.jokerId === 'burntJoker')!
    bj.counter = 1

    const cardIds = Object.keys(game.cards).slice(0, 2)
    game.gamePlayState.selectedCardIds = cardIds

    const levelsBefore = Object.fromEntries(
      Object.entries(game.pokerHands).map(([hand, state]) => [hand, state.level])
    )

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })

    const anyHandUpgraded = Object.entries(after.pokerHands).some(
      ([hand, state]) => state.level > levelsBefore[hand]
    )
    expect(anyHandUpgraded).toBe(false)
  })

  it('resets counter to 0 on SMALL_BLIND_SELECTED', () => {
    const game = setupGame()
    const bj = game.jokers.find(j => j.jokerId === 'burntJoker')!
    bj.counter = 1

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    const bjAfter = after.jokers.find(j => j.jokerId === 'burntJoker')
    expect(bjAfter?.counter).toBe(0)
  })

  it('resets counter to 0 on BIG_BLIND_SELECTED', () => {
    const game = setupGame()
    const bj = game.jokers.find(j => j.jokerId === 'burntJoker')!
    bj.counter = 1

    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })
    const bjAfter = after.jokers.find(j => j.jokerId === 'burntJoker')
    expect(bjAfter?.counter).toBe(0)
  })

  it('resets counter to 0 on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    const bj = game.jokers.find(j => j.jokerId === 'burntJoker')!
    bj.counter = 1

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    const bjAfter = after.jokers.find(j => j.jokerId === 'burntJoker')
    expect(bjAfter?.counter).toBe(0)
  })
})
