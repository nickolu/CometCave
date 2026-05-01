import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState, ScoringEvent } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

function findRaisedFistEvent(game: GameState): ScoringEvent | undefined {
  return game.gamePlayState.scoringEvents.find(
    (e): e is ScoringEvent => 'source' in e && (e as ScoringEvent).source === 'Raised Fist'
  ) as ScoringEvent | undefined
}

describe('Raised Fist joker', () => {
  it('adds double the rank of the lowest held card to Mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.raisedFist, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Find a 3 (priority/rank 2) and a King (priority/rank 12)
    const threeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '3'
    )!
    const kingId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    )!

    // Hold both cards in hand (neither played)
    game.gamePlayState.handIds = [threeId, kingId]
    game.gamePlayState.playedCardIds = []

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findRaisedFistEvent(after)

    // Lowest rank is 3 (priority 2), so bonus = 2 * 2 = 4
    expect(event).toBeDefined()
    expect(event?.value).toBe(4)
    expect(event?.type).toBe('mult')
  })

  it('only considers held cards (not played cards)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.raisedFist, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Find a 2 (rank 1) and a Queen (rank 11)
    const twoId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '2'
    )!
    const queenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'Q'
    )!

    // 2 is played, Queen is held
    game.gamePlayState.handIds = [twoId, queenId]
    game.gamePlayState.playedCardIds = [twoId]

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findRaisedFistEvent(after)

    // Only Queen is held (rank 11), so bonus = 11 * 2 = 22
    expect(event).toBeDefined()
    expect(event?.value).toBe(22)
  })

  it('no bonus when all cards are played (no held cards)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.raisedFist, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    // All hand cards are also played
    game.gamePlayState.handIds = [aceId]
    game.gamePlayState.playedCardIds = [aceId]

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findRaisedFistEvent(after)

    expect(event).toBeUndefined()
  })

  it('scoring event has source Raised Fist and type mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.raisedFist, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!

    game.gamePlayState.handIds = [jackId]
    game.gamePlayState.playedCardIds = []

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findRaisedFistEvent(after)

    // Jack has priority 10, bonus = 10 * 2 = 20
    expect(event).toBeDefined()
    expect(event?.source).toBe('Raised Fist')
    expect(event?.type).toBe('mult')
    expect(event?.value).toBe(20)
  })
})
