import type { Effect } from '@/app/comet-cards/domain/events/types'

export interface JokerDefinition {
  id: string
  name: string
  description: string
  price: number
  effects: Effect[]
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

export interface JokerState {
  id: string
  jokerId: JokerDefinition['id']
  flags: JokerFlags
  edition: 'holographic' | 'foil' | 'polychrome' | 'negative' | 'normal'
  isFaceUp: boolean
  bonusSellValue: number
  counter: number
  metadata?: Record<string, number>
}

export interface JokerFlags {
  isRentable: boolean
  isPerishable: boolean
  isEternal: boolean
}
