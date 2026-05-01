import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Ride the Bus joker', () => {
  it('increments counter when no face cards are scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.rideTheBus, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const nonFaceId = Object.keys(game.cards).find(id =>
      !['J', 'Q', 'K'].includes(playingCards[game.cards[id].playingCardId]?.value)
    )!

    game.gamePlayState.selectedHand = ['pair', [game.cards[nonFaceId]]]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const rtbInstance = after.jokers.find(j => j.jokerId === 'rideTheBus')
    expect(rtbInstance?.counter).toBe(1)
  })

  it('resets counter to 0 when a face card is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.rideTheBus, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Prime the counter to 2
    game.jokers[0].counter = 2

    const faceId = Object.keys(game.cards).find(id =>
      ['J', 'Q', 'K'].includes(playingCards[game.cards[id].playingCardId]?.value)
    )!

    game.gamePlayState.selectedHand = ['pair', [game.cards[faceId]]]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const rtbInstance = after.jokers.find(j => j.jokerId === 'rideTheBus')
    expect(rtbInstance?.counter).toBe(0)
  })

  it('applies accumulated mult matching the counter value', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.rideTheBus, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const nonFaceIds = Object.keys(game.cards).filter(id =>
      !['J', 'Q', 'K'].includes(playingCards[game.cards[id].playingCardId]?.value)
    ).slice(0, 2)

    // First hand: counter goes 0 -> 1, +1 mult applied
    game.gamePlayState.selectedHand = ['pair', [game.cards[nonFaceIds[0]]]]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after1 = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after1.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ride the Bus' && 'value' in e && e.value === 1
    )).toBe(true)

    // Second hand: counter goes 1 -> 2, +2 mult applied
    const after2 = reduceGame({
      ...after1,
      gamePlayState: {
        ...after1.gamePlayState,
        scoringEvents: [],
        selectedHand: ['pair', [game.cards[nonFaceIds[1]]]],
        score: { chips: 10, mult: 5 },
      },
    }, { type: 'HAND_SCORING_FINALIZE' })

    const rtbInstance = after2.jokers.find(j => j.jokerId === 'rideTheBus')
    expect(rtbInstance?.counter).toBe(2)
    expect(after2.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ride the Bus' && 'value' in e && e.value === 2
    )).toBe(true)
  })

  it('does not apply mult when counter is 0 after face card resets it', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.rideTheBus, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const faceId = Object.keys(game.cards).find(id =>
      ['J', 'Q', 'K'].includes(playingCards[game.cards[id].playingCardId]?.value)
    )!

    game.gamePlayState.selectedHand = ['pair', [game.cards[faceId]]]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Ride the Bus'
    )).toBe(false)
  })
})
