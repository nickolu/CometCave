import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Spare Trousers joker', () => {
  it('gains +2 Mult and applies it on first Two Pair hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.spareTrousersJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    // First hand: play a Two Pair - gains +2 and immediately applies it
    const hand1: GameState = { ...started, gamePlayState: { ...started.gamePlayState, selectedHand: ['twoPair', []], score: { chips: 10, mult: 5 } } }
    const after1 = reduceGame(hand1, { type: 'HAND_SCORING_FINALIZE' })
    const st1 = after1.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st1?.metadata?.multBonus).toBe(2)

    // Spare Trousers scoring event IS present on first hand (bonus incremented first, then applied)
    const spareEvent = after1.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Spare Trousers'
    )
    expect(spareEvent).toBeDefined()
    expect((spareEvent as { value: number }).value).toBe(2)
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

  it('applies +4 mult on second consecutive Two Pair hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.spareTrousersJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    // First Two Pair hand: accumulates +2, applies +2
    const hand1: GameState = { ...started, gamePlayState: { ...started.gamePlayState, selectedHand: ['twoPair', []], score: { chips: 10, mult: 5 } } }
    const after1 = reduceGame(hand1, { type: 'HAND_SCORING_FINALIZE' })

    // Second Two Pair hand: accumulates another +2 (total 4), applies +4
    const hand2: GameState = { ...after1, gamePlayState: { ...after1.gamePlayState, selectedHand: ['twoPair', []], scoringEvents: [], score: { chips: 10, mult: 5 } } }
    const after2 = reduceGame(hand2, { type: 'HAND_SCORING_FINALIZE' })
    const st2 = after2.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st2?.metadata?.multBonus).toBe(4)

    const spareEvent = after2.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Spare Trousers'
    )
    expect(spareEvent).toBeDefined()
    expect((spareEvent as { value: number }).value).toBe(4)
  })
})
