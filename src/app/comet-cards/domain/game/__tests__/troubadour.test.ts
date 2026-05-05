import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

describe('Troubadour joker', () => {
  it('increases handSizeModifier by 2 and decreases maxHands by 1 on JOKER_ADDED (purchase)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = []

    const troubadourState = initializeJoker(jokers.troubadour, game)
    const buyable: BuyableCard = {
      type: 'jokerCard',
      card: troubadourState,
      price: jokers.troubadour.price,
    }

    game.money = 999
    game.shopState.cardsForSale = [buyable]
    game.shopState.selectedCardId = troubadourState.id

    const afterPurchase = reduceGame(game, { type: 'SHOP_BUY_CARD' })

    expect(afterPurchase.jokers.some(j => j.jokerId === 'troubadour')).toBe(true)
    expect(afterPurchase.handSizeModifier).toBe(defaultGameState.handSizeModifier + 2)
    expect(afterPurchase.maxHands).toBe(defaultGameState.maxHands - 1)
  })

  it('reverts handSizeModifier and maxHands on JOKER_REMOVED', () => {
    const game: GameState = structuredClone(defaultGameState)
    const troubadourInstance = initializeJoker(jokers.troubadour, game)
    game.jokers = [troubadourInstance]
    game.handSizeModifier = defaultGameState.handSizeModifier + 2
    game.maxHands = defaultGameState.maxHands - 1

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: troubadourInstance.id },
    }

    const afterRemoval = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(afterRemoval.jokers.some(j => j.jokerId === 'troubadour')).toBe(false)
    expect(afterRemoval.handSizeModifier).toBe(defaultGameState.handSizeModifier)
    expect(afterRemoval.maxHands).toBe(defaultGameState.maxHands)
  })

  it('does not revert when another Troubadour remains after removal', () => {
    const game: GameState = structuredClone(defaultGameState)
    const troubadour1 = initializeJoker(jokers.troubadour, game)
    const troubadour2 = initializeJoker(jokers.troubadour, game)
    game.jokers = [troubadour1, troubadour2]
    game.handSizeModifier = defaultGameState.handSizeModifier + 4
    game.maxHands = defaultGameState.maxHands - 2

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: troubadour1.id },
    }

    const afterRemoval = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(afterRemoval.jokers.filter(j => j.jokerId === 'troubadour')).toHaveLength(1)
    expect(afterRemoval.handSizeModifier).toBe(defaultGameState.handSizeModifier + 4)
    expect(afterRemoval.maxHands).toBe(defaultGameState.maxHands - 2)
  })
})
