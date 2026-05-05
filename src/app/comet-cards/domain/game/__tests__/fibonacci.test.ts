import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Fibonacci joker', () => {
  it('gives +8 Mult when an Ace is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fibonacci, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Fibonacci' && e.value === 8
    )).toBe(true)
  })

  it('gives +8 Mult when a 2 is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fibonacci, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const twoId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '2'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[twoId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Fibonacci' && e.value === 8
    )).toBe(true)
  })

  it('no effect on non-fibonacci rank cards (4, K)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fibonacci, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const fourId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '4'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[fourId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Fibonacci'
    )).toBe(false)
  })

  it('scoring event has source Fibonacci and type mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fibonacci, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const fiveId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '5'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[fiveId]] },
    }, { type: 'CARD_SCORED' })
    const event = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Fibonacci'
    )
    expect(event).toBeDefined()
    expect(event?.type).toBe('mult')
  })
})
