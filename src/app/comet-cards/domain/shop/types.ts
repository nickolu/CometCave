import type {
  CelestialCardState,
  TarotCardState,
} from '@/app/comet-cards/domain/consumable/types'
import type { JokerState } from '@/app/comet-cards/domain/joker/types'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import type { SpectralCardState } from '@/app/comet-cards/domain/spectral/types'
import type { VoucherType } from '@/app/comet-cards/domain/voucher/types'

export interface ShopState {
  baseRerollPrice: number
  cardsForSale: BuyableCard[]
  celestialMultiplier: number
  guaranteedForSaleItems: BuyableCard[]
  isOpen: boolean
  maxCardsForSale: number
  maxVouchersForSale: number
  openPackState: PackState | null
  packsForSale: PackState[]
  playingCard: {
    multiplier: number
    editionBaseChance: number
    enchantmentBaseChance: number
    chipBaseChance: number
    editionWeights: {
      holographic: number
      foil: number
      polychrome: number
    }
  }
  freeRerolls: number
  priceMultiplier: number
  rerollsUsed: number
  selectedCardId: string | null
  tarotCard: {
    multiplier: number
  }
  joker: {
    multiplier: number
    editionWeights: {
      holographic: number
      foil: number
      polychrome: number
      negative: number
      normal: number
    }
  }
  voucher: VoucherType | null
}

export interface PackState {
  id: string
  cards: BuyableCard[]
  rarity: 'jumbo' | 'normal' | 'mega'
  remainingCardsToSelect: number
}
export interface BuyableCard {
  type: 'celestialCard' | 'tarotCard' | 'jokerCard' | 'playingCard' | 'spectralCard'
  card: PlayingCardState | CelestialCardState | TarotCardState | JokerState | SpectralCardState
  price: number
}

export interface PackDefinition {
  cardType: 'celestialCard' | 'tarotCard' | 'jokerCard' | 'playingCard' | 'spectralCard'
  rarity: 'jumbo' | 'normal' | 'mega'
  price: number
  numberOfCardsPerPack: number
  numberOfCardsToSelect: number
}
