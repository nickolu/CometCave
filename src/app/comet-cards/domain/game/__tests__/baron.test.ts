import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Baron joker', () => {
  it('applies X1.5 per King held in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.baronJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Put 2 Kings in hand
    const kingIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    ).slice(0, 2)
    game.gamePlayState.handIds = kingIds
    game.gamePlayState.score = { chips: 10, mult: 10 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const baronEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Baron'
    )
    expect(baronEvents.length).toBe(2)
  })

  it('no effect when no Kings in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.baronJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Put non-King cards in hand
    const nonKingIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value !== 'K'
    ).slice(0, 3)
    game.gamePlayState.handIds = nonKingIds
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Baron'
    )).toBe(false)
  })
})
