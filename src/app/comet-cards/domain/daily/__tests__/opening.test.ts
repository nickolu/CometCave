import { describe, expect, it } from 'vitest'

import { LAST_ANTE_OPENING_PACKS, LAST_ANTE_STARTING_MONEY } from '@/app/comet-cards/domain/daily/constants'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function startRun(): GameState {
  return reduceGame(structuredClone(defaultGameState), { type: 'START_LAST_ANTE' })
}

describe('The Opening', () => {
  it('is where a Last Ante run begins', () => {
    const game = startRun()
    expect(game.gamePhase).toBe('opening')
    expect(game.lastAnte?.openingResolved).toBe(false)
  })

  it('deals the full spread of packs', () => {
    const packs = startRun().shopState.packsForSale
    expect(packs).toHaveLength(LAST_ANTE_OPENING_PACKS.length)

    const types = packs.map(pack => pack.cards[0].type)
    expect(types.filter(t => t === 'jokerCard')).toHaveLength(2)
    expect(types).toContain('celestialCard')
    expect(types).toContain('playingCard')
    expect(types).toContain('spectralCard')
    // Tarot is how a deck gets designed, so there is more than one — but they
    // are the slowest packs to open, so the picks come from pack size rather
    // than from a long row of openings.
    const tarot = packs.filter(pack => pack.cards[0].type === 'tarotCard')
    expect(tarot.length).toBeGreaterThanOrEqual(3)
    expect(tarot.length).toBeLessThanOrEqual(4)

    const tarotPicks = tarot.reduce((sum, pack) => sum + pack.remainingCardsToSelect, 0)
    expect(tarotPicks).toBeGreaterThanOrEqual(6)
  })

  it('deals six different packs, not the same pack six times', () => {
    const packs = startRun().shopState.packsForSale
    const contents = packs.map(pack => pack.cards.map(c => c.card.id).join(','))
    expect(new Set(contents).size).toBe(packs.length)
  })

  it('gives real choices inside each pack', () => {
    for (const pack of startRun().shopState.packsForSale) {
      expect(pack.cards.length).toBeGreaterThanOrEqual(3)
      expect(pack.remainingCardsToSelect).toBeGreaterThanOrEqual(1)
    }
  })

  it('costs nothing to open, so the purse survives for the shop', () => {
    let game = startRun()
    expect(game.money).toBe(LAST_ANTE_STARTING_MONEY)

    for (const pack of [...game.shopState.packsForSale]) {
      game = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: pack.id })
      game = reduceGame(game, { type: 'PACK_OPEN_SKIP' })
    }
    expect(game.money).toBe(LAST_ANTE_STARTING_MONEY)
  })

  it('returns to the shelf after a pack, not to a shop that has not opened', () => {
    const game = startRun()
    const opened = reduceGame(game, {
      type: 'SHOP_OPEN_PACK',
      id: game.shopState.packsForSale[0].id,
    })
    expect(opened.gamePhase).toBe('packOpening')
    expect(reduceGame(opened, { type: 'SHOP_CLOSE_PACK' }).gamePhase).toBe('opening')
    expect(reduceGame(opened, { type: 'PACK_OPEN_SKIP' }).gamePhase).toBe('opening')
  })

  it('hands the player to the shop, stocked and with the purse intact', () => {
    const game = reduceGame(startRun(), { type: 'OPENING_CONFIRMED' })
    expect(game.gamePhase).toBe('shop')
    expect(game.lastAnte?.openingResolved).toBe(true)
    expect(game.money).toBe(LAST_ANTE_STARTING_MONEY)
    expect(game.shopState.cardsForSale.length).toBeGreaterThan(0)
    expect(game.shopState.packsForSale.length).toBeGreaterThan(0)
    expect(game.shopState.packsForSale.every(pack => !pack.isFree)).toBe(true)
  })

  it('runs the whole pre-blind sequence: opening, shop, memories', () => {
    let game = reduceGame(startRun(), { type: 'OPENING_CONFIRMED' })
    game = reduceGame(game, { type: 'SHOP_SELECT_BLIND' })
    expect(game.gamePhase).toBe('memories')
    game = reduceGame(game, { type: 'MEMORIES_CONFIRMED' })
    expect(game.gamePhase).toBe('blindSelection')
  })

  it('will not overfill the joker slots from a pack', () => {
    let game = startRun()
    const jokerPack = game.shopState.packsForSale.find(p => p.cards[0].type === 'jokerCard')!
    game = reduceGame(game, { type: 'SHOP_OPEN_PACK', id: jokerPack.id })

    const full = structuredClone(game)
    full.maxJokers = 0
    const after = reduceGame(full, {
      type: 'SHOP_SELECT_JOKER_FROM_PACK',
      id: full.shopState.openPackState!.cards[0].card.id,
    })
    expect(after.jokers).toHaveLength(0)
  })
})
