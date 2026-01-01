/**
 * Card Registry Utilities
 *
 * Helper functions for working with the ID-based card registry architecture.
 * These functions provide a clean abstraction layer over the card registry,
 * hiding the indirection of ID-based lookups.
 *
 * Key concepts:
 * - `cards` (Record<string, PlayingCardState>): Single source of truth for all card state
 * - `ownedCardIds`: Which cards the player owns (persists between blinds)
 * - `handIds`, `drawPileIds`: Where cards are currently located (transient)
 */

import type { GameState } from './types'
import type { PlayingCardState } from '../playing-card/types'

/**
 * Get a single card by ID from the registry
 * @throws Error if card doesn't exist
 */
export function getCard(game: GameState, cardId: string): PlayingCardState {
  const card = game.cards[cardId]
  if (!card) {
    throw new Error(`Card with id ${cardId} not found in registry`)
  }
  return card
}

/**
 * Get a single card by ID, returning undefined if not found
 */
export function getCardOrUndefined(game: GameState, cardId: string): PlayingCardState | undefined {
  return game.cards[cardId]
}

/**
 * Get multiple cards by IDs from the registry
 * Filters out any IDs that don't exist in the registry
 */
export function getCards(game: GameState, cardIds: string[]): PlayingCardState[] {
  return cardIds
    .map(id => game.cards[id])
    .filter((card): card is PlayingCardState => card !== undefined)
}

/**
 * Get all cards currently in the player's hand
 */
export function getHand(game: GameState): PlayingCardState[] {
  return getCards(game, game.gamePlayState.handIds)
}

/**
 * Get all cards in the draw pile (remaining deck for current blind)
 */
export function getDrawPile(game: GameState): PlayingCardState[] {
  return getCards(game, game.gamePlayState.drawPileIds)
}

/**
 * Get all cards in the discard pile
 */
export function getDiscardPile(game: GameState): PlayingCardState[] {
  return getCards(game, game.gamePlayState.discardPileIds || [])
}

/**
 * Get all cards the player owns (entire collection)
 */
export function getOwnedCards(game: GameState): PlayingCardState[] {
  return getCards(game, game.ownedCardIds)
}

/**
 * Check if a card exists in the registry
 */
export function cardExists(game: GameState, cardId: string): boolean {
  return game.cards[cardId] !== undefined
}

/**
 * Add a card to the registry
 * Note: This only adds to the registry, not to any location (hand, deck, etc)
 * You must also add the ID to the appropriate location array
 */
export function addCardToRegistry(game: GameState, card: PlayingCardState): void {
  game.cards[card.id] = card
}

/**
 * Remove a card from the registry
 * Note: This only removes from the registry. You must also remove the ID
 * from any location arrays (handIds, drawPileIds, ownedCardIds, etc)
 */
export function removeCardFromRegistry(game: GameState, cardId: string): void {
  delete game.cards[cardId]
}

/**
 * Update a card's properties in the registry
 * Uses Object.assign for shallow merge
 */
export function updateCard(
  game: GameState,
  cardId: string,
  updates: Partial<PlayingCardState>
): void {
  const card = game.cards[cardId]
  if (!card) {
    throw new Error(`Cannot update card ${cardId}: not found in registry`)
  }
  Object.assign(card, updates)
}

/**
 * Add a card to the game (both registry and owned collection)
 * This is the most common operation when acquiring a new card
 */
export function addOwnedCard(game: GameState, card: PlayingCardState): void {
  addCardToRegistry(game, card)
  game.ownedCardIds.push(card.id)
}

/**
 * Remove a card from the game entirely (registry and all locations)
 * Use this when a card is destroyed/removed from the game
 */
export function removeOwnedCard(game: GameState, cardId: string): void {
  // Remove from registry
  removeCardFromRegistry(game, cardId)

  // Remove from owned cards
  game.ownedCardIds = game.ownedCardIds.filter(id => id !== cardId)

  // Remove from any gameplay locations
  game.gamePlayState.handIds = game.gamePlayState.handIds.filter(id => id !== cardId)
  game.gamePlayState.drawPileIds = game.gamePlayState.drawPileIds.filter(id => id !== cardId)
  if (game.gamePlayState.discardPileIds) {
    game.gamePlayState.discardPileIds = game.gamePlayState.discardPileIds.filter(id => id !== cardId)
  }
}

/**
 * Move cards from the draw pile to the hand
 * @param count Number of cards to deal
 * @returns The IDs of cards that were dealt
 */
export function dealCardsFromDrawPile(game: GameState, count: number): string[] {
  const cardIdsToDeal = game.gamePlayState.drawPileIds.splice(0, count)
  game.gamePlayState.handIds.push(...cardIdsToDeal)
  return cardIdsToDeal
}

/**
 * Move cards from hand to discard pile
 * @param cardIds IDs of cards to discard
 */
export function discardCardsFromHand(game: GameState, cardIds: string[]): void {
  // Remove from hand
  game.gamePlayState.handIds = game.gamePlayState.handIds.filter(
    id => !cardIds.includes(id)
  )

  // Add to discard pile
  if (!game.gamePlayState.discardPileIds) {
    game.gamePlayState.discardPileIds = []
  }
  game.gamePlayState.discardPileIds.push(...cardIds)
}

/**
 * Get selected cards (cards that are currently selected in the UI)
 */
export function getSelectedCards(game: GameState): PlayingCardState[] {
  return getCards(game, game.gamePlayState.selectedCardIds)
}

/**
 * Get cards that are being scored (cards in the current hand being played)
 */
export function getScoringCards(game: GameState): PlayingCardState[] {
  return getCards(game, game.gamePlayState.playedCardIds)
}

/**
 * Validate registry consistency
 * Useful for debugging - checks that all ID references point to existing cards
 * @returns Array of error messages (empty if valid)
 */
export function validateRegistry(game: GameState): string[] {
  const errors: string[] = []

  // Check owned cards
  for (const id of game.ownedCardIds) {
    if (!cardExists(game, id)) {
      errors.push(`ownedCardIds references missing card: ${id}`)
    }
  }

  // Check hand
  for (const id of game.gamePlayState.handIds) {
    if (!cardExists(game, id)) {
      errors.push(`handIds references missing card: ${id}`)
    }
  }

  // Check draw pile
  for (const id of game.gamePlayState.drawPileIds) {
    if (!cardExists(game, id)) {
      errors.push(`drawPileIds references missing card: ${id}`)
    }
  }

  // Check discard pile
  if (game.gamePlayState.discardPileIds) {
    for (const id of game.gamePlayState.discardPileIds) {
      if (!cardExists(game, id)) {
        errors.push(`discardPileIds references missing card: ${id}`)
      }
    }
  }

  // Check selected cards
  for (const id of game.gamePlayState.selectedCardIds) {
    if (!cardExists(game, id)) {
      errors.push(`selectedCardIds references missing card: ${id}`)
    }
  }

  return errors
}

/**
 * Get stats about the card registry (useful for debugging)
 */
export function getRegistryStats(game: GameState): {
  totalCardsInRegistry: number
  ownedCards: number
  cardsInHand: number
  cardsInDrawPile: number
  cardsInDiscardPile: number
  orphanedCards: number // Cards in registry but not in any location
} {
  const totalCardsInRegistry = Object.keys(game.cards).length
  const ownedCards = game.ownedCardIds.length
  const cardsInHand = game.gamePlayState.handIds.length
  const cardsInDrawPile = game.gamePlayState.drawPileIds.length
  const cardsInDiscardPile = game.gamePlayState.discardPileIds?.length || 0

  // Cards that are in registry but not referenced anywhere
  const allReferencedIds = new Set([
    ...game.ownedCardIds,
    ...game.gamePlayState.handIds,
    ...game.gamePlayState.drawPileIds,
    ...(game.gamePlayState.discardPileIds || []),
  ])
  const orphanedCards = Object.keys(game.cards).filter(id => !allReferencedIds.has(id)).length

  return {
    totalCardsInRegistry,
    ownedCards,
    cardsInHand,
    cardsInDrawPile,
    cardsInDiscardPile,
    orphanedCards,
  }
}
