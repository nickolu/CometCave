import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Stuntman joker', () => {
  it('reduces hand size by 2 on GAME_START', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.stuntmanJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.handSizeModifier).toBe(-2)
  })

  it('adds +250 Chips on HAND_SCORING_FINALIZE', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.stuntmanJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })
    const afterScore = reduceGame(started, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Stuntman' && e.value === 250
    )).toBe(true)
  })

  it('reverts hand size when sold', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.stuntmanJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.handSizeModifier).toBe(-2)
    const instance = started.jokers.find(j => j.jokerId === 'stuntmanJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.handSizeModifier).toBe(0)
  })
})
