import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Photograph joker', () => {
  it('first face card scored gives X2 Mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.photograph, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[jackId]] },
    }, { type: 'CARD_SCORED' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Photograph' && 'operator' in e && e.operator === 'x' && e.value === 2
    )).toBe(true)
    expect(after.gamePlayState.score.mult).toBe(10)
  })

  it('second face card does NOT give X2 Mult (only first per hand)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.photograph, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const faceCardIds = Object.keys(game.cards).filter(id =>
      ['J', 'Q', 'K'].includes(playingCards[game.cards[id].playingCardId]?.value)
    )
    const [firstId, secondId] = faceCardIds

    // Score first face card
    const afterFirst = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[firstId]] },
    }, { type: 'CARD_SCORED' })

    // Score second face card
    const afterSecond = reduceGame({
      ...afterFirst,
      gamePlayState: { ...afterFirst.gamePlayState, cardsToScore: [afterFirst.cards[secondId]] },
    }, { type: 'CARD_SCORED' })

    const photographEvents = afterSecond.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Photograph'
    )
    expect(photographEvents).toHaveLength(1)
  })

  it('non-face cards do not trigger', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.photograph, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const fiveId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '5'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[fiveId]] },
    }, { type: 'CARD_SCORED' })

    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Photograph'
    )).toBe(false)
  })
})
