import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Fortune Teller joker', () => {
  it('gives +1 Mult per Tarot card used', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fortuneTellerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.consumablesUsed = [
      { id: '1', consumableType: 'tarotCard', name: 'The Fool', isFaceUp: true, tarotType: 'theFool' } as any,
      { id: '2', consumableType: 'tarotCard', name: 'The Magician', isFaceUp: true, tarotType: 'theMagician' } as any,
      { id: '3', consumableType: 'tarotCard', name: 'The Empress', isFaceUp: true, tarotType: 'theEmpress' } as any,
    ]
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Fortune Teller' && e.value === 3
      )
    ).toBe(true)
  })

  it('no effect when no Tarot cards used', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.fortuneTellerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(e => 'source' in e && e.source === 'Fortune Teller')
    ).toBe(false)
  })
})
