import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithJudgement(overrides: Partial<GameState> = {}): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const judgementCard = {
    id: 'judgement-1',
    consumableType: 'tarotCard' as const,
    name: 'Judgement',
    isFaceUp: true,
    tarotType: 'judgement' as const,
  }
  game.consumables = [judgementCard]
  game.gamePlayState.selectedConsumable = judgementCard
  return { ...game, ...overrides }
}

describe('Judgement tarot card', () => {
  it('creates a joker when there is room', () => {
    const game = makeGameWithJudgement()
    expect(game.jokers.length).toBe(0)
    expect(game.maxJokers).toBe(5)

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.jokers.length).toBe(1)
  })

  it('does not create a joker when jokers are full', () => {
    const game = makeGameWithJudgement({ maxJokers: 0 })
    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.jokers.length).toBe(0)
  })
})
