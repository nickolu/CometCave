import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Sock and Buskin joker', () => {
  it('retriggers face cards (J, Q, K)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.sockAndBuskin, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const queenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'Q'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[queenId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Sock and Buskin'
    )).toBe(true)
  })

  it('does not retrigger non-face cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.sockAndBuskin, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const threeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '3'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[threeId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Sock and Buskin'
    )).toBe(false)
  })
})
