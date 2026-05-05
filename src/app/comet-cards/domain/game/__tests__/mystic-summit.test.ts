import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Mystic Summit joker', () => {
  it('gives +15 Mult when 0 discards remaining', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.mysticSummit, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.maxDiscards = 3
    game.discardsPlayed = 3 // 0 remaining discards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Mystic Summit' && e.value === 15
    )).toBe(true)
  })

  it('gives no mult bonus when discards remain', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.mysticSummit, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.maxDiscards = 3
    game.discardsPlayed = 1 // 2 remaining discards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Mystic Summit'
    )).toBe(false)
  })

  it('scoring event has source Mystic Summit and type mult', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.mysticSummit, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.maxDiscards = 3
    game.discardsPlayed = 3 // 0 remaining discards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const mysticSummitEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Mystic Summit'
    )
    expect(mysticSummitEvent).toBeDefined()
    expect(mysticSummitEvent).toMatchObject({ source: 'Mystic Summit', type: 'mult', value: 15 })
  })
})
