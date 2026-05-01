import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

function makeGameWithTemperance(jokerIds: string[], bonusSellValues: number[] = []): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.money = 0
  game.jokers = jokerIds.map((id, i) => {
    const joker = initializeJoker(jokers[id], game)
    if (bonusSellValues[i]) {
      joker.bonusSellValue = bonusSellValues[i]
    }
    return joker
  })
  const temperanceCard = {
    id: 'temperance-1',
    consumableType: 'tarotCard' as const,
    name: 'Temperance',
    isFaceUp: true,
    tarotType: 'temperance' as const,
  }
  game.consumables = [temperanceCard]
  game.gamePlayState.selectedConsumable = temperanceCard
  return game
}

describe('Temperance tarot card', () => {
  it('gains the total sell value of all jokers', () => {
    // jokerJoker has price 2, greedyJoker has price 5
    const game = makeGameWithTemperance(['jokerJoker', 'greedyJoker'])
    const jokerJokerPrice = jokers['jokerJoker'].price
    const greedyJokerPrice = jokers['greedyJoker'].price
    const expectedGain = jokerJokerPrice + greedyJokerPrice

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(expectedGain)
  })

  it('includes bonusSellValue in total', () => {
    const game = makeGameWithTemperance(['jokerJoker'], [3])
    const jokerJokerPrice = jokers['jokerJoker'].price
    const expectedGain = jokerJokerPrice + 3

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(expectedGain)
  })

  it('caps gain at $50', () => {
    // Use many jokers to exceed $50
    const manyJokers = Array(10).fill('jokerJoker')
    const game = makeGameWithTemperance(manyJokers, Array(10).fill(10))
    // Each jokerJoker: price=2 + bonusSell=10 = 12, times 10 = 120 → capped at 50

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(50)
  })

  it('gives $0 when no jokers are active', () => {
    const game = makeGameWithTemperance([])
    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(0)
  })
})
