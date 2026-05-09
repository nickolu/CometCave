import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Matador joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.matador, game)]
    game.gamePhase = 'gameplay'
    game.gamePlayState.remainingHands = 5
    game.gamePlayState.score = { chips: 1, mult: 1 }
    game.money = 0
    // Ensure the current round has a boss blind with effects
    const bossBlindWithEffects = bossBlinds.find(b => b.effects.length > 0)
    if (bossBlindWithEffects) {
      game.rounds[game.roundIndex].bossBlindName = bossBlindWithEffects.name
    }
    return game
  }

  it('earns $8 during boss blind round', () => {
    const game = setupGame()
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(8)
  })

  it('does not earn $8 during small blind round', () => {
    const game = setupGame()
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(0)
  })

  it('does not earn $8 during big blind round', () => {
    const game = setupGame()
    game.rounds[game.roundIndex].bigBlind.status = 'inProgress'

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(0)
  })
})
