import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Banner joker', () => {
  it('gives +30 Chips per remaining discard', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.banner, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.maxDiscards = 3
    game.discardsPlayed = 0 // 3 remaining discards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Banner' && e.value === 90
    )).toBe(true)
  })

  it('gives 0 chips when 0 discards remaining', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.banner, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.maxDiscards = 3
    game.discardsPlayed = 3 // 0 remaining discards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Banner'
    )).toBe(false)
  })

  it('scoring event has source Banner and type chips', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.banner, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.maxDiscards = 3
    game.discardsPlayed = 1 // 2 remaining discards
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const bannerEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Banner'
    )
    expect(bannerEvent).toBeDefined()
    expect(bannerEvent).toMatchObject({ source: 'Banner', type: 'chips', value: 60 })
  })
})
