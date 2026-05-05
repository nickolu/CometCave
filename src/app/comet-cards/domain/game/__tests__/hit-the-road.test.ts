import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Hit the Road joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hitTheRoad, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('counter increases by 1 per Jack discarded (stored as halves)', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 2

    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!

    game.gamePlayState.selectedCardIds = [jackId]

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    expect(htrAfter?.counter).toBe(3)
  })

  it('counter does not increase for non-Jack discards', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 2

    const nonJackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value !== 'J'
    )!

    game.gamePlayState.selectedCardIds = [nonJackId]

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    expect(htrAfter?.counter).toBe(2)
  })

  it('counter increases by 1 per Jack when multiple Jacks discarded', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 2

    const jackIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    ).slice(0, 2)

    game.gamePlayState.selectedCardIds = jackIds

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    expect(htrAfter?.counter).toBe(2 + jackIds.length)
  })

  it('lazy init: sets counter to 2 on first DISCARD_SELECTED_CARDS if counter is 0', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    expect(htr.counter).toBe(0)

    const nonJackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value !== 'J'
    )!

    game.gamePlayState.selectedCardIds = [nonJackId]

    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    // counter initialized to 2, no Jacks discarded, stays at 2
    expect(htrAfter?.counter).toBe(2)
  })

  it('applies X Mult = counter/2 on HAND_SCORING_FINALIZE when counter > 2', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    // counter=4 means X2 Mult (4/2)
    htr.counter = 4

    game.gamePlayState.score = { chips: 10, mult: 1 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Hit the Road' && 'value' in e && e.value === 2 && 'operator' in e && e.operator === 'x'
    )).toBe(true)
  })

  it('does not apply X Mult when counter is 2 (X1 = no change)', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 2

    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Hit the Road'
    )).toBe(false)
  })

  it('applies X1.5 Mult when one Jack has been discarded (counter=3)', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 3

    game.gamePlayState.score = { chips: 10, mult: 2 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Hit the Road' && 'value' in e && e.value === 1.5 && 'operator' in e && e.operator === 'x'
    )).toBe(true)
  })

  it('resets counter to 2 on SMALL_BLIND_SELECTED', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 6

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    expect(htrAfter?.counter).toBe(2)
  })

  it('resets counter to 2 on BIG_BLIND_SELECTED', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 6

    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    expect(htrAfter?.counter).toBe(2)
  })

  it('resets counter to 2 on BOSS_BLIND_SELECTED', () => {
    const game = setupGame()
    const htr = game.jokers.find(j => j.jokerId === 'hitTheRoad')!
    htr.counter = 6

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    const htrAfter = after.jokers.find(j => j.jokerId === 'hitTheRoad')
    expect(htrAfter?.counter).toBe(2)
  })
})
