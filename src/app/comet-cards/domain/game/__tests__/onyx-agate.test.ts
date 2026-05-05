import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Onyx Agate joker', () => {
  it('gives +7 Mult when a Club card is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.onyxAgateJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const clubId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'clubs'
    )!
    const afterScore = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[clubId]] },
    }, { type: 'CARD_SCORED' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Onyx Agate' && e.value === 7
    )).toBe(true)
  })

  it('does not give mult for non-Club cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.onyxAgateJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const spadesId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'spades'
    )!
    const afterScore = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[spadesId]] },
    }, { type: 'CARD_SCORED' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Onyx Agate'
    )).toBe(false)
  })
})
