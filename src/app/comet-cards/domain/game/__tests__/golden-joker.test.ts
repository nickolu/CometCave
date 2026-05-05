import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

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
