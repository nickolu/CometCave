import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Flash Card joker', () => {
  it('gains +2 Mult on SHOP_REROLL', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.flashCardJoker, game)]
    game.gamePhase = 'shop'
    game.shopState.isOpen = true
    const started = reduceGame(game, { type: 'GAME_START' })
    const afterReroll = reduceGame({ ...started, gamePhase: 'shop', shopState: { ...started.shopState, isOpen: true } }, { type: 'SHOP_REROLL' })
    const fc = afterReroll.jokers.find(j => j.jokerId === 'flashCardJoker')
    expect(fc?.metadata?.multBonus).toBe(2)
  })

  it('does not add Mult on HAND_SCORING_FINALIZE when no rerolls', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.flashCardJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })
    const afterScore = reduceGame(started, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Flash Card'
    )).toBe(false)
  })
})
