import { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  buildSeedString,
  getRandomNumberWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'

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
    spectralType: definition.spectralType,
  }
}

export function isSpectralCardState(card: unknown): card is SpectralCardState {
  return (
    typeof card === 'object' &&
    card !== null &&
    'spectralType' in card &&
    !('consumableType' in card)
  )
}
