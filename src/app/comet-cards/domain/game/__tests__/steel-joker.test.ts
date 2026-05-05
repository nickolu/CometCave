import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Steel Joker', () => {
  it('applies X Mult based on Steel Cards in deck', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.steelJokerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    // Make 3 cards steel
    const cardIds = game.ownedCardIds.slice(0, 3)
    for (const id of cardIds) {
      game.cards[id].flags.enchantment = 'steel'
    }
    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // 3 steel = X1.6
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Steel Joker' && 'operator' in e && e.operator === 'x' && e.value === 1.6
    )).toBe(true)
  })

  it('no effect when no Steel Cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.steelJokerJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Steel Joker'
    )).toBe(false)
  })
})
