import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Shoot the Moon joker', () => {
  it('gives +13 Mult per Queen held in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.shootTheMoonJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const queenIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'Q'
    ).slice(0, 2)
    game.gamePlayState.handIds = queenIds
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Shoot the Moon' && e.value === 26
    )).toBe(true)
  })

  it('no effect when no Queens in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.shootTheMoonJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const nonQueenIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value !== 'Q'
    ).slice(0, 3)
    game.gamePlayState.handIds = nonQueenIds
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Shoot the Moon'
    )).toBe(false)
  })
})
