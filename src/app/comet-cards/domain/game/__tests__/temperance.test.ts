import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

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
    // sell values: floor(2/2)=1, floor(5/2)=2, total=3
    const game = makeGameWithTemperance(['jokerJoker', 'greedyJoker'])
    const jokerJokerSell = Math.floor(jokers['jokerJoker'].price / 2)
    const greedyJokerSell = Math.floor(jokers['greedyJoker'].price / 2)
    const expectedGain = jokerJokerSell + greedyJokerSell

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(expectedGain)
  })

  it('includes bonusSellValue in total', () => {
    // jokerJoker price=2, sell=floor(2/2)=1, bonusSellValue=3, total=4
    const game = makeGameWithTemperance(['jokerJoker'], [3])
    const jokerJokerSell = Math.floor(jokers['jokerJoker'].price / 2)
    const expectedGain = jokerJokerSell + 3

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(expectedGain)
  })

  it('caps gain at $50', () => {
    // Use many jokers to exceed $50
    const manyJokers = Array(10).fill('jokerJoker')
    const game = makeGameWithTemperance(manyJokers, Array(10).fill(10))
    // Each jokerJoker: sell=floor(2/2)=1 + bonusSell=10 = 11, times 10 = 110 → capped at 50

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(50)
  })

  it('gives $0 when no jokers are active', () => {
    const game = makeGameWithTemperance([])
    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.money).toBe(0)
  })
})
