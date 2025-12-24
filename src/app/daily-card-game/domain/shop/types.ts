import type {
  Arcane,
  Celestial,
  VoucherDefinition,
} from '@/app/daily-card-game/domain/consumable/types'
import type { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCardDefinition } from '@/app/daily-card-game/domain/playing-card/types'

export interface ShopState {
  cardsForSale: BuyableCard[]
  packsForSale: Pack[]
  vouchersForSale: VoucherDefinition[]
  rerollsUsed: number
  rerollPrice: number
  modifiers: ShopStateModifiers
}

export interface BuyableCard {
  type: PlayingCardDefinition | Celestial | Arcane | JokerDefinition
  price: number
}

export interface Pack {
  card: Celestial | Arcane | JokerDefinition | PlayingCardDefinition
  type: 'jumbo' | 'normal' | 'mega'
  price: number
}

export interface ShopStateModifiers {
  maxCardsForSale: number
  maxVouchersForSale: number
  baseRerollPrice: number
}
