import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import type { PackState } from '@/app/comet-cards/domain/shop/types'

/**
 * A card can only be in one place at a time. When it is in two, React renders
 * two children with the same key and the player sees the same card twice.
 */

function startRun(): GameState {
  return reduceGame(structuredClone(defaultGameState), { type: 'START_LAST_ANTE' })
}

function packsOfType(game: GameState, type: string): PackState[] {
  return game.shopState.packsForSale.filter(pack => pack.cards[0].type === type)
}

function expectNoDuplicates(ids: string[], what: string) {
  expect(new Set(ids).size, `${what} contains a duplicate id`).toBe(ids.length)
}

describe('cards never appear twice', () => {
  it('keeps the hand unique when several tarot packs are opened in a row', () => {
    let game = startRun()
    const tarotPacks = packsOfType(game, 'tarotCard')
    expect(tarotPacks.length).toBeGreaterThan(1)

    for (const pack of tarotPacks) {
      game = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: pack.id })
      expectNoDuplicates(game.gamePlayState.handIds, 'hand after opening a tarot pack')
      game = reduceGame(game, { type: 'PACK_OPEN_SKIP' })
    }
  })

  it('deals a different hand from each tarot pack', () => {
    let game = startRun()
    const tarotPacks = packsOfType(game, 'tarotCard')
    const hands: string[] = []

    for (const pack of tarotPacks.slice(0, 3)) {
      game = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: pack.id })
      hands.push([...game.gamePlayState.handIds].sort().join(','))
      game = reduceGame(game, { type: 'PACK_OPEN_SKIP' })
    }

    expect(new Set(hands).size, 'every tarot pack dealt the same eight cards').toBe(hands.length)
  })

  it('keeps the deck unique when a pack offers more than one pick', () => {
    let game = startRun()
    // Force a multi-pick standard pack, the shape that let one card be taken twice.
    const staged = structuredClone(game)
    const standard = staged.shopState.packsForSale.find(p => p.cards[0].type === 'playingCard')!
    standard.remainingCardsToSelect = 2
    game = staged

    game = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: standard.id })
    const firstCardId = game.shopState.openPackState!.cards[0].card.id

    game = reduceGame(game, { type: 'SHOP_SELECT_PLAYING_CARD_FROM_PACK', id: firstCardId })
    // Selecting the same card again must do nothing — it is off the shelf.
    game = reduceGame(game, { type: 'SHOP_SELECT_PLAYING_CARD_FROM_PACK', id: firstCardId })

    expectNoDuplicates(game.ownedCardIds, 'deck after picking from a pack')
    expect(game.ownedCardIds.filter(id => id === firstCardId)).toHaveLength(1)
  })

  it('never deals a card the player is already holding', () => {
    const game = structuredClone(startRun())
    const held = game.ownedCardIds.slice(0, 3)
    game.gamePlayState.handIds = [...held]
    game.gamePlayState.drawPileIds = [...game.ownedCardIds]

    const dealt = reduceGame(game, { type: 'HAND_DEALT' })
    expectNoDuplicates(dealt.gamePlayState.handIds, 'hand after dealing over a held hand')
  })
})
