import { GameState } from '@/app/comet-cards/domain/game/types'
import {
  buildSeedString,
  getRandomNumberWithSeed,
  uuid,
} from '@/app/comet-cards/domain/randomness'

import { implementedSpectralCards as spectralCards } from './spectal-cards'
import { SpectralCardDefinition, SpectralCardState, SpectralCardType } from './types'

export function getRandomSpectralCardType(game: GameState): SpectralCardType {
  const seed = buildSeedString([game.gameSeed, game.roundIndex.toString()])
  const spectralCardTypes = Object.values(spectralCards).map(card => card.spectralType)
  const randomCardIndex = getRandomNumberWithSeed(seed, 0, spectralCardTypes.length - 1)
  return spectralCardTypes[randomCardIndex]
}

export function initializeSpectralCard(definition: SpectralCardDefinition): SpectralCardState {
  return {
    id: uuid(),
    consumableType: 'spectralCard',
    spectralType: definition.spectralType,
  }
}

// Spectral cards are the only consumable with a `spectralType`, and runs saved
// before they carried a `consumableType` are still in localStorage, so the shape
// is the guard rather than the discriminant.
export function isSpectralCardState(card: unknown): card is SpectralCardState {
  return typeof card === 'object' && card !== null && 'spectralType' in card
}

/**
 * What a held Spectral sells for. Spectral cards are never priced — they come
 * out of packs and decks, not shops — so selling one pays a flat amount rather
 * than half of a price it does not have.
 */
export const SPECTRAL_SELL_VALUE = 2
