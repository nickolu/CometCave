import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Arrowhead joker', () => {
  it('gives +50 Chips when a Spade card is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.arrowheadJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const spadeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'spades'
    )!
    const afterScore = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[spadeId]] },
    }, { type: 'CARD_SCORED' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Arrowhead' && e.value === 50
    )).toBe(true)
  })

  it('does not give chips for non-Spade cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.arrowheadJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const heartsId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'hearts'
    )!
    const afterScore = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[heartsId]] },
    }, { type: 'CARD_SCORED' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Arrowhead'
    )).toBe(false)
  })
})
