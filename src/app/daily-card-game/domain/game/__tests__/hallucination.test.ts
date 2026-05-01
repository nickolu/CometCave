import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import type { PackState } from '@/app/daily-card-game/domain/shop/types'

// With gameSeed='test-seed-1', roundIndex=1: roll=1 (success)
// With gameSeed='test-seed', roundIndex=1:   roll=2 (failure)
const SUCCESS_SEED = 'test-seed-1'
const FAILURE_SEED = 'test-seed'

function makeJokerPack(): PackState {
  return {
    id: 'pack-1',
    rarity: 'normal',
    remainingCardsToSelect: 1,
    cards: [
      {
        type: 'jokerCard',
        card: {} as any,
        price: 4,
      },
    ],
  }
}

function makeGame(gameSeed: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.gameSeed = gameSeed
  game.jokers = [initializeJoker(jokers.hallucination, game)]
  game.money = 100
  game.shopState.packsForSale = [makeJokerPack()]
  return game
}

describe('Hallucination joker', () => {
  it('creates a Tarot card when roll succeeds and room is available', () => {
    const game = makeGame(SUCCESS_SEED)
    const before = game.consumables.length

    const after = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: 'pack-1' })

    expect(after.consumables.length).toBe(before + 1)
    expect(after.consumables[after.consumables.length - 1].consumableType).toBe('tarotCard')
  })

  it('does not create a Tarot card when roll fails', () => {
    const game = makeGame(FAILURE_SEED)
    const before = game.consumables.length

    const after = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: 'pack-1' })

    expect(after.consumables.length).toBe(before)
  })

  it('does not create a Tarot card when consumables are full', () => {
    const game = makeGame(SUCCESS_SEED)

    // Fill consumables to capacity
    game.consumables = Array.from({ length: game.maxConsumables }, (_, i) => ({
      id: `tarot-${i}`,
      consumableType: 'tarotCard' as const,
      name: 'The Fool',
      isFaceUp: true,
      tarotType: 'theFool' as const,
    }))

    const before = game.consumables.length
    const after = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: 'pack-1' })

    expect(after.consumables.length).toBe(before)
  })
})
