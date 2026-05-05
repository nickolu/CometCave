import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Rocket joker', () => {
  function createGameWithRocket(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.rocketJoker, game)]
    return game
  }

  it('initializes payout to 1 on GAME_START', () => {
    const game = createGameWithRocket()
    const started = reduceGame(game, { type: 'GAME_START' })
    const rk = started.jokers.find(j => j.jokerId === 'rocketJoker')
    expect(rk?.metadata?.payout).toBe(1)
  })

  it('pays out $1 on ROUND_END', () => {
    const game = createGameWithRocket()
    const started = reduceGame(game, { type: 'GAME_START' })
    const initialMoney = started.money

    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 1)
  })

  it('increases payout by $2 when boss blind is completed', () => {
    const game = createGameWithRocket()
    const started = reduceGame(game, { type: 'GAME_START' })

    // Simulate boss blind completed
    const withBossCompleted: GameState = {
      ...started,
      rounds: started.rounds.map((round, i) =>
        i === started.roundIndex
          ? { ...round, bossBlind: { ...round.bossBlind, status: 'completed' as const } }
          : round
      ),
    }

    const afterRound = reduceGame(withBossCompleted, { type: 'ROUND_END' })
    const rk = afterRound.jokers.find(j => j.jokerId === 'rocketJoker')
    expect(rk?.metadata?.payout).toBe(3) // 1 + 2
  })

  it('does not increase payout on non-boss blind rounds', () => {
    const game = createGameWithRocket()
    const started = reduceGame(game, { type: 'GAME_START' })

    // Boss blind is notStarted (default)
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    const rk = afterRound.jokers.find(j => j.jokerId === 'rocketJoker')
    expect(rk?.metadata?.payout).toBe(1) // unchanged
  })
})
