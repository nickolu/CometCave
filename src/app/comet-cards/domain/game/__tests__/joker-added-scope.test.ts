import { describe, expect, it } from 'vitest'

import { dealCardsFromDrawPile } from '@/app/comet-cards/domain/game/card-registry-utils'
import { HAND_SIZE } from '@/app/comet-cards/domain/game/constants'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

/**
 * `JOKER_ADDED` is a lifecycle event about the joker that just arrived.
 *
 * It used to be dispatched through `collectEffects`, which returns every held
 * joker's effects, so buying any joker re-ran the one-time acquire effect of
 * every joker bought before it. Stuntman took another two cards off the hand
 * on each purchase, Merry Andy another discard, until the blind dealt nothing
 * and the run could not be played.
 */
function buyJoker(game: GameState, jokerId: string): GameState {
  const jokerState = initializeJoker(jokers[jokerId], game)
  const buyable: BuyableCard = {
    type: 'jokerCard',
    card: jokerState,
    price: jokers[jokerId].price,
  }
  const withShop: GameState = {
    ...game,
    money: 999,
    shopState: { ...game.shopState, cardsForSale: [buyable], selectedCardId: jokerState.id },
  }
  return reduceGame(withShop, { type: 'SHOP_BUY_CARD' })
}

describe('JOKER_ADDED is scoped to the joker that was added', () => {
  it('applies a hand-size cost once, not once per later purchase', () => {
    let game: GameState = structuredClone(defaultGameState)
    game.jokers = []

    game = buyJoker(game, 'stuntmanJoker')
    expect(game.handSizeModifier).toBe(-2)

    // Greedy Joker has no acquire effect at all, so nothing should move.
    game = buyJoker(game, 'greedyJoker')
    expect(game.handSizeModifier).toBe(-2)

    game = buyJoker(game, 'lustyJoker')
    expect(game.handSizeModifier).toBe(-2)
  })

  it('still deals a hand after a shop full of jokers', () => {
    let game: GameState = structuredClone(defaultGameState)
    game.jokers = []
    game.maxJokers = 5

    for (const id of ['stuntmanJoker', 'merryAndyJoker', 'greedyJoker', 'lustyJoker']) {
      game = buyJoker(game, id)
    }

    // Stuntman -2, Merry Andy -1, and nothing else touches hand size.
    expect(game.handSizeModifier).toBe(-3)

    const atBlind = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    const dealt = reduceGame(atBlind, { type: 'HAND_DEALT' })
    expect(dealt.gamePlayState.handIds).toHaveLength(HAND_SIZE - 3)
  })

  it('does not inflate discards for jokers bought earlier', () => {
    let game: GameState = structuredClone(defaultGameState)
    game.jokers = []
    const baseDiscards = game.maxDiscards

    game = buyJoker(game, 'merryAndyJoker')
    game = buyJoker(game, 'drunkardJoker')
    game = buyJoker(game, 'greedyJoker')

    expect(game.maxDiscards).toBe(baseDiscards + 3 + 1)
  })

  it('leaves a hand to deal when a pack hands over the joker', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = []
    let withJokers = game
    for (const id of ['stuntmanJoker', 'troubadour']) {
      withJokers = buyJoker(withJokers, id)
    }

    // Stuntman -2, Troubadour +2.
    expect(withJokers.handSizeModifier).toBe(0)
    expect(withJokers.maxHands).toBe(game.maxHands - 1)

    const dealtInto = structuredClone(withJokers)
    dealtInto.gamePlayState.drawPileIds = [...dealtInto.ownedCardIds]
    dealCardsFromDrawPile(dealtInto, HAND_SIZE + dealtInto.handSizeModifier)
    expect(dealtInto.gamePlayState.handIds).toHaveLength(HAND_SIZE)
  })
})
