import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithHermit(money: number): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.money = money
  const hermitCard = {
    id: 'hermit-1',
    consumableType: 'tarotCard' as const,
    name: 'The Hermit',
    isFaceUp: true,
    tarotType: 'theHermit' as const,
  }
  game.consumables = [hermitCard]
  game.gamePlayState.selectedConsumable = hermitCard
  return game
}

describe('The Hermit tarot card', () => {
  it('doubles money from $10 to $20', () => {
    const game = makeGameWithHermit(10)
    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(20)
  })

  it('caps gain at $20 when money is $30 (result is $50)', () => {
    const game = makeGameWithHermit(30)
    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(50)
  })

  it('no gain when money is $0', () => {
    const game = makeGameWithHermit(0)
    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(0)
  })
})
