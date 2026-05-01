import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import type { BuyableCard } from '@/app/daily-card-game/domain/shop/types'

describe('Showman joker', () => {
  it('sets allowDuplicateJokersInShop to true when Showman is purchased (JOKER_ADDED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = []
    game.staticRules.allowDuplicateJokersInShop = false

    const showmanState = initializeJoker(jokers.showman, game)
    const buyable: BuyableCard = {
      type: 'jokerCard',
      card: showmanState,
      price: jokers.showman.price,
    }

    game.money = 999
    game.shopState.cardsForSale = [buyable]
    game.shopState.selectedCardId = showmanState.id

    const afterPurchase = reduceGame(game, { type: 'SHOP_BUY_CARD' })

    expect(afterPurchase.jokers.some(j => j.jokerId === 'showman')).toBe(true)
    expect(afterPurchase.staticRules.allowDuplicateJokersInShop).toBe(true)
  })

  it('resets allowDuplicateJokersInShop to false when Showman is removed (JOKER_REMOVED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    const showmanInstance = initializeJoker(jokers.showman, game)
    game.jokers = [showmanInstance]
    game.staticRules.allowDuplicateJokersInShop = true

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: showmanInstance.id },
    }

    const afterRemoval = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(afterRemoval.jokers.some(j => j.jokerId === 'showman')).toBe(false)
    expect(afterRemoval.staticRules.allowDuplicateJokersInShop).toBe(false)
  })

  it('does not reset allowDuplicateJokersInShop when another Showman remains after removal', () => {
    const game: GameState = structuredClone(defaultGameState)
    const showman1 = initializeJoker(jokers.showman, game)
    const showman2 = initializeJoker(jokers.showman, game)
    game.jokers = [showman1, showman2]
    game.staticRules.allowDuplicateJokersInShop = true

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: showman1.id },
    }

    const afterRemoval = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(afterRemoval.jokers.filter(j => j.jokerId === 'showman')).toHaveLength(1)
    expect(afterRemoval.staticRules.allowDuplicateJokersInShop).toBe(true)
  })
})
