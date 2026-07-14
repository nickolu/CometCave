import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState, ScoringEvent } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Seltzer joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.seltzer, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('retriggered scored card adds baseChips again', () => {
    const game = setupGame()
    // Set counter > 0 so seltzer is active
    game.jokers[0].counter = 5

    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })

    const seltzerEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Seltzer'
    )
    expect(seltzerEvents).toHaveLength(1)
    // Ace baseChips = 11
    expect((seltzerEvents[0] as ScoringEvent).value).toBe(11)
    expect((seltzerEvents[0] as ScoringEvent).type).toBe('chips')
  })

  it('counter initializes to 10 and decrements by 1 on HAND_SCORING_FINALIZE', () => {
    const game = setupGame()
    // counter starts at 0 (lazy init)

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedHand: ['pair', []], score: { chips: 0, mult: 1 } },
    }, { type: 'HAND_SCORING_FINALIZE' })

    const seltzer = after.jokers.find(j => j.jokerId === 'seltzer')
    // 10 initialized, then decremented by 1 = 9
    expect(seltzer?.counter).toBe(9)
  })

  it('self-destructs when counter reaches 0 after 10 hands', () => {
    const game = setupGame()
    // counter starts at 0 (lazy init), will become 10 then count down

    let state: GameState = game

    for (let i = 0; i < 10; i++) {
      state = reduceGame({
        ...state,
        gamePlayState: { ...state.gamePlayState, selectedHand: ['pair', []], score: { chips: 0, mult: 1 } },
      }, { type: 'HAND_SCORING_FINALIZE' })
    }

    const seltzerInstance = state.jokers.find(j => j.jokerId === 'seltzer')
    expect(seltzerInstance).toBeUndefined()
  })

  it('does not retrigger when counter is 0 (destroyed)', () => {
    const game = setupGame()
    // counter explicitly 0 = inactive (before lazy init or after destruction)
    // Simulate already-destroyed by having no counter > 0 and calling CARD_SCORED
    // We do NOT set counter here so it's 0 (uninitialised)

    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    // Manually deplete seltzer counter to 0 by running 10 HAND_SCORING_FINALIZE events
    let state: GameState = game
    for (let i = 0; i < 10; i++) {
      state = reduceGame({
        ...state,
        gamePlayState: { ...state.gamePlayState, selectedHand: ['pair', []], score: { chips: 0, mult: 1 } },
      }, { type: 'HAND_SCORING_FINALIZE' })
    }

    // Seltzer should be gone - CARD_SCORED should not produce any Seltzer events
    const after = reduceGame({
      ...state,
      gamePlayState: { ...state.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })

    const seltzerEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Seltzer'
    )
    expect(seltzerEvents).toHaveLength(0)
  })
})
