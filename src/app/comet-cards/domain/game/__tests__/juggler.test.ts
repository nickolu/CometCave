import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Juggler joker', () => {
  it('adds +1 hand size on GAME_START', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.jugglerJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.handSizeModifier).toBe(1)
  })

  it('reverts when sold', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.jugglerJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    expect(started.handSizeModifier).toBe(1)
    const instance = started.jokers.find(j => j.jokerId === 'jugglerJoker')!
    const selected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: instance.id } }
    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.handSizeModifier).toBe(0)
  })
})
