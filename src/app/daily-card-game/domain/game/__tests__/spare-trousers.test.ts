import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Spare Trousers joker', () => {
  it('gains +2 Mult after Two Pair is played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.spareTrousersJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    // First hand: play a Two Pair - no bonus yet (starts at 0), but gains +2
    const hand1: GameState = { ...started, gamePlayState: { ...started.gamePlayState, selectedHand: ['twoPair', []], score: { chips: 10, mult: 5 } } }
    const after1 = reduceGame(hand1, { type: 'HAND_SCORING_FINALIZE' })
    const st1 = after1.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st1?.metadata?.multBonus).toBe(2)

    // No Spare Trousers scoring event on first hand (bonus was 0)
    expect(after1.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Spare Trousers'
    )).toBe(false)
  })

  it('does not gain when non-Two Pair hand played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.spareTrousersJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    const hand: GameState = { ...started, gamePlayState: { ...started.gamePlayState, selectedHand: ['pair', []], score: { chips: 10, mult: 5 } } }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const st = after.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st?.metadata?.multBonus).toBe(0)
  })
})
