import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Black Hole spectral card', () => {
  it('upgrades every poker hand by 1 level', () => {
    const game: GameState = structuredClone(defaultGameState)

    // Set up a pack with a Black Hole spectral card
    game.shopState.openPackState = {
      id: 'test-pack',
      cards: [
        {
          card: { id: 'black-hole-1', spectralType: 'blackHole' } as any,
          type: 'spectralCard',
          cardType: 'spectralCard',
          price: 0,
        },
      ],
      rarity: 'normal',
      remainingCardsToSelect: 1,
    }

    // Record initial levels
    const initialLevels: Record<string, number> = {}
    for (const [handId, hand] of Object.entries(game.pokerHands)) {
      initialLevels[handId] = hand.level
    }

    const after = reduceGame(game, {
      type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK',
      id: 'black-hole-1',
    })

    // Verify every poker hand level increased by 1
    for (const [handId, hand] of Object.entries(after.pokerHands)) {
      expect(hand.level).toBe(initialLevels[handId] + 1)
    }
  })
})
