import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Golden Joker', () => {
  it('earns $4 on ROUND_END', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.goldenJokerJoker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 4)
  })
})
