import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Delayed Gratification', () => {
  it('earns $2 per maxDiscards when no discards are used by end of round', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.delayedGratification, game)]
    game.maxDiscards = 3
    game.discardsPlayed = 0
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 6)
  })

  it('earns $0 when any discards were used', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.delayedGratification, game)]
    game.maxDiscards = 3
    game.discardsPlayed = 1
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney)
  })
})
