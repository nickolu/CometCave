import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Drunkard joker', () => {
  it('adds +1 discard on GAME_START', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.drunkardJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.maxDiscards).toBe(defaultGameState.maxDiscards + 1)
  })

  it('reverts when sold', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.drunkardJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    const instance = started.jokers.find(j => j.jokerId === 'drunkardJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.maxDiscards).toBe(defaultGameState.maxDiscards)
  })
})
