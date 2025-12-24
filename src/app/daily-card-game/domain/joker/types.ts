import type { Effect } from '@/app/daily-card-game/domain/events/types'

export interface JokerDefinition {
  id: string
  name: string
  description: string
  price: number
  effects: Effect[]
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

export interface JokerFlags {
  isRentable: boolean
  isPerishable: boolean
  isEternal: boolean
  isHolographic: boolean
  isFoil: boolean
  isNegative: boolean
  faceUp: boolean
}
