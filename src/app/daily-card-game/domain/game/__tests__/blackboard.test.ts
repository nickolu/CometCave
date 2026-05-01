import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState, ScoringEvent } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

function findBlackboardEvent(game: GameState): ScoringEvent | undefined {
  return game.gamePlayState.scoringEvents.find(
    (e): e is ScoringEvent => 'source' in e && (e as ScoringEvent).source === 'Blackboard'
  ) as ScoringEvent | undefined
}

describe('Blackboard joker', () => {
  it('gives X3 Mult when all held cards are spades or clubs', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.blackboard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const blackCardIds = Object.keys(game.cards).filter(id => {
      const suit = playingCards[game.cards[id].playingCardId]?.suit
      return suit === 'spades' || suit === 'clubs'
    }).slice(0, 3)

    game.gamePlayState.handIds = blackCardIds
    game.gamePlayState.playedCardIds = []

    const initialMult = game.gamePlayState.score.mult
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findBlackboardEvent(after)

    expect(event).toBeDefined()
    expect(event?.type).toBe('mult')
    expect(event?.operator).toBe('x')
    expect(event?.value).toBe(3)
    expect(after.gamePlayState.score.mult).toBe(initialMult * 3)
  })

  it('no X3 Mult when any held card is hearts or diamonds', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.blackboard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const spadeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'spades'
    )!
    const heartId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'hearts'
    )!

    game.gamePlayState.handIds = [spadeId, heartId]
    game.gamePlayState.playedCardIds = []

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findBlackboardEvent(after)

    expect(event).toBeUndefined()
  })

  it('no effect when no held cards (all played)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.blackboard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const spadeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'spades'
    )!

    game.gamePlayState.handIds = [spadeId]
    game.gamePlayState.playedCardIds = [spadeId]

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const event = findBlackboardEvent(after)

    expect(event).toBeUndefined()
  })
})
