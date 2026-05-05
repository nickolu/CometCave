import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Seeing Double joker', () => {
  it('applies X2 Mult with Club and non-Club cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.seeingDoubleJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Find a club card and a hearts card
    const clubId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'clubs'
    )!
    const heartsId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'hearts'
    )!

    game.gamePlayState.selectedHand = ['pair', [game.cards[clubId], game.cards[heartsId]]]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Seeing Double' && 'operator' in e && e.operator === 'x'
    )).toBe(true)
  })

  it('does not apply with only Club cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.seeingDoubleJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const clubIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'clubs'
    ).slice(0, 2)

    game.gamePlayState.selectedHand = ['pair', clubIds.map(id => game.cards[id])]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Seeing Double'
    )).toBe(false)
  })
})
