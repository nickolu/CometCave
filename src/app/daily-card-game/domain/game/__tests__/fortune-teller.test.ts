import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Fortune Teller joker', () => {
  it('gives +1 Mult per Tarot card used', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fortuneTellerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Add 3 used tarot cards
    game.consumablesUsed = [
      { id: '1', type: 'tarotCard', name: 'The Fool', isFaceUp: true } as any,
      { id: '2', type: 'tarotCard', name: 'The Magician', isFaceUp: true } as any,
      { id: '3', type: 'tarotCard', name: 'The Empress', isFaceUp: true } as any,
    ]
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Fortune Teller' && e.value === 3
    )).toBe(true)
  })

  it('no effect when no Tarot cards used', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fortuneTellerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Fortune Teller'
    )).toBe(false)
  })
})
