import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Diet Cola joker', () => {
  it('creates a Double Tag when sold', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.dietColaJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    expect(started.tags.filter(t => t.tagType === 'double')).toHaveLength(0)

    const dcInstance = started.jokers.find(j => j.jokerId === 'dietColaJoker')!
    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: dcInstance.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    expect(afterSale.jokers.some(j => j.jokerId === 'dietColaJoker')).toBe(false)
    expect(afterSale.tags.filter(t => t.tagType === 'double')).toHaveLength(1)
  })

  it('does not create a tag when another joker is sold', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      initializeJoker(jokers.dietColaJoker, game),
      initializeJoker(jokers.jokerJoker, game),
    ]
    const started = reduceGame(game, { type: 'GAME_START' })

    // Sell the basic Joker, not Diet Cola
    const basicJoker = started.jokers.find(j => j.jokerId === 'jokerJoker')!
    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: basicJoker.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })
    // Diet Cola should still be there, and no Double Tag created
    expect(afterSale.jokers.some(j => j.jokerId === 'dietColaJoker')).toBe(true)
    expect(afterSale.tags.filter(t => t.tagType === 'double')).toHaveLength(0)
  })
})
