import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { Celestial } from '@/app/daily-card-game/domain/consumable/types'
import { Arcane } from '@/app/daily-card-game/domain/consumable/types'
import { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import { VoucherDefinition } from '@/app/daily-card-game/domain/consumable/types'

export interface ShopState {
  cardsForSale: BuyableCard[]
  packsForSale: Pack[]
  vouchersForSale: VoucherDefinition[]
  rerollsUsed: number
  rerollPrice: number
  modifiers: ShopStateModifiers
}

export interface BuyableCard {
  type: PlayingCard | Celestial | Arcane | JokerDefinition
  price: number
}

export interface Pack {
  card: Celestial | Arcane | JokerDefinition | PlayingCard
  type: 'jumbo' | 'normal' | 'mega'
  price: number
}

export interface ShopStateModifiers {
  maxCardsForSale: number
  maxVouchersForSale: number
  baseRerollPrice: number
}
