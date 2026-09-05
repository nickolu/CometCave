import { describe, expect, it } from 'vitest'

import {
  createGameStateWithDeck,
  defaultGameState,
} from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { spectralCards } from '@/app/comet-cards/domain/spectral/spectal-cards'
import { initializeSpectralCard } from '@/app/comet-cards/domain/spectral/utils'

/**
 * A Spectral can arrive already held — Ghost Deck's Hex, Seance, Sixth Sense —
 * rather than off the top of a pack. Those used to be dead weight: the UI read
 * them as Celestials with no definition behind them, so they showed as a blank
 * "Celestial" that could be neither used nor sold, and they sat in a slot for
 * the whole run.
 */
describe('a Spectral card held in a consumable slot', () => {
  const withHeldHex = (): GameState => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [
      initializeJoker(jokers.jokerJoker, game),
      initializeJoker(jokers.greedyJoker, game),
    ]
    game.consumables = [initializeSpectralCard(spectralCards.hex)]
    return game
  }

  it('is selectable', () => {
    const game = withHeldHex()
    const after = reduceGame(game, { type: 'CONSUMABLE_SELECTED', id: game.consumables[0].id })
    expect(after.gamePlayState.selectedConsumable?.id).toBe(game.consumables[0].id)
  })

  it('applies its effect when used and leaves the slot', () => {
    const game = withHeldHex()
    const selected = reduceGame(game, { type: 'CONSUMABLE_SELECTED', id: game.consumables[0].id })
    const after = reduceGame(selected, { type: 'SPECTRAL_CARD_USED' })

    // Hex adds Polychrome to a random Joker and destroys the rest.
    expect(after.jokers).toHaveLength(1)
    expect(after.jokers[0].edition).toBe('polychrome')
    expect(after.consumables).toHaveLength(0)
    expect(after.consumablesUsed).toHaveLength(1)
    expect(after.gamePlayState.selectedConsumable).toBeUndefined()
  })

  it('is not spent when the card cannot be played', () => {
    const game = withHeldHex()
    game.jokers = []
    const selected = reduceGame(game, { type: 'CONSUMABLE_SELECTED', id: game.consumables[0].id })
    const after = reduceGame(selected, { type: 'SPECTRAL_CARD_USED' })

    expect(after.consumables).toHaveLength(1)
    expect(after.consumablesUsed).toHaveLength(0)
  })

  it('can be sold for money and frees the slot', () => {
    const game = withHeldHex()
    game.money = 10
    const selected = reduceGame(game, { type: 'CONSUMABLE_SELECTED', id: game.consumables[0].id })
    const after = reduceGame(selected, { type: 'CONSUMABLE_SOLD' })

    expect(after.consumables).toHaveLength(0)
    expect(after.money).toBeGreaterThan(10)
    expect(after.gamePlayState.selectedConsumable).toBeUndefined()
  })

  it("does not block Ghost Deck's second slot for the whole run", () => {
    const game = createGameStateWithDeck('ghostDeck')
    game.jokers = [initializeJoker(jokers.jokerJoker, game)]
    const hex = game.consumables[0]
    const selected = reduceGame(game, { type: 'CONSUMABLE_SELECTED', id: hex.id })
    const after = reduceGame(selected, { type: 'SPECTRAL_CARD_USED' })

    expect(after.consumables).toHaveLength(0)
  })
})
