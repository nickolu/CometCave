// Weights for pack rarity selection based on pack type
// Standard (playingCard), Arcana (tarotCard), and Celestial packs share the same weights

import type { PackDefinition, PackState } from '@/app/comet-cards/domain/shop/types'

// Buffoon (jokerCard) and Spectral packs are rarer
export type PackRarityWeights = Record<PackState['rarity'], number>
export type ImplementedPackType = PackDefinition['cardType']
