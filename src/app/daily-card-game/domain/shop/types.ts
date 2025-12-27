import type {
  CelestialCardState,
  TarotCardState,
} from '@/app/daily-card-game/domain/consumable/types'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'

export interface ShopState {
  baseRerollPrice: number
  cardsForSale: BuyableCard[]
  celestialMultiplier: number
  maxCardsForSale: number
  maxVouchersForSale: number
  openPackState: OpenPackState | null
  packsForSale: Pack[]
  playingCardMultiplier: number
  rerollsUsed: number
  selectedCardId: string | null
  tarotCardMultiplier: number
}

export interface OpenPackState {
  cards: BuyableCard[]
  packType: 'jumbo' | 'normal' | 'mega'
  cardType: 'celestialCard' | 'tarotCard' | 'jokerCard' | 'playingCard' | 'spectralCard'
}
export interface BuyableCard {
  type: 'celestialCard' | 'tarotCard' | 'jokerCard' | 'playingCard' | 'spectralCard'
  card: PlayingCardState | CelestialCardState | TarotCardState | JokerState
  price: number
}

export interface Pack {
  cardType: 'celestialCard' | 'tarotCard' | 'jokerCard' | 'playingCard'
  type: 'jumbo' | 'normal' | 'mega'
  price: number
}
