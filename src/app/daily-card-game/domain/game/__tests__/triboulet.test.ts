import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Triboulet joker', () => {
  it('gives X2 Mult when a King is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.triboulet, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const kingId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    )!
    game.gamePlayState.score = { chips: 10, mult: 10 }
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[kingId]] },
    }, { type: 'CARD_SCORED' })
    const tribouletEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Triboulet'
    )
    expect(tribouletEvents.length).toBe(1)
    expect(tribouletEvents[0]).toMatchObject({ operator: 'x', value: 2 })
    expect(after.gamePlayState.score.mult).toBe(20)
  })

  it('gives X2 Mult when a Queen is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.triboulet, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const queenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'Q'
    )!
    game.gamePlayState.score = { chips: 10, mult: 10 }
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[queenId]] },
    }, { type: 'CARD_SCORED' })
    const tribouletEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Triboulet'
    )
    expect(tribouletEvents.length).toBe(1)
    expect(tribouletEvents[0]).toMatchObject({ operator: 'x', value: 2 })
    expect(after.gamePlayState.score.mult).toBe(20)
  })

  it('does NOT give X2 Mult when a Jack is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.triboulet, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const jackId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'J'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[jackId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Triboulet'
    )).toBe(false)
  })
})
