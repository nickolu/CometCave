import type { PackState } from '@/app/daily-card-game/domain/shop/types'

import { ImplementedPackType, PackRarityWeights } from './types'

export const numberOfCardsPerRarity: Record<PackState['rarity'], number> = {
  normal: 3,
  jumbo: 5,
  mega: 7,
}

export const numberOfCardsToSelectPerRarity: Record<PackState['rarity'], number> = {
  normal: 1,
  jumbo: 1,
  mega: 2,
}

export const pricePerRarity: Record<PackState['rarity'], number> = {
  normal: 4,
  jumbo: 6,
  mega: 8,
}

// Pack weights matching expected probabilities:
// Standard/Arcana/Celestial: Normal 4 (53.52%), Jumbo 2 (26.76%), Mega 0.5 (6.69%)
// Buffoon: Normal 1.2 (5.35%), Jumbo 0.6 (2.67%), Mega 0.15 (0.66%)
// Spectral: Normal 0.6 (2.67%), Jumbo 0.3 (1.34%), Mega 0.075 (0.31%)
export const packRarityWeightsByType: Record<ImplementedPackType, PackRarityWeights> = {
  playingCard: { normal: 4, jumbo: 2, mega: 0.5 }, // Standard
  tarotCard: { normal: 4, jumbo: 2, mega: 0.5 }, // Arcana
  celestialCard: { normal: 4, jumbo: 2, mega: 0.5 }, // Celestial
  jokerCard: { normal: 1.2, jumbo: 0.6, mega: 0.15 }, // Buffoon
  spectralCard: { normal: 0.6, jumbo: 0.3, mega: 0.075 }, // Spectral
}

// Pack type weights (sum of all rarity weights for each type)
// This makes Standard/Arcana/Celestial more common than Buffoon and Spectral
export const packTypeWeights: Record<ImplementedPackType, number> = {
  playingCard: 6.5, // 4 + 2 + 0.5
  tarotCard: 6.5, // 4 + 2 + 0.5
  celestialCard: 6.5, // 4 + 2 + 0.5
  jokerCard: 1.95, // 1.2 + 0.6 + 0.15
  spectralCard: 0.975, // 0.6 + 0.3 + 0.075
}
