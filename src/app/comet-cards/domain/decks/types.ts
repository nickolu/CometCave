import { TarotCardDefinition } from '@/app/comet-cards/domain/consumable/types'
import { Effect } from '@/app/comet-cards/domain/events/types'
import { PlayingCardDefinition } from '@/app/comet-cards/domain/playing-card/types'
import { VoucherType } from '@/app/comet-cards/domain/voucher/types'

export interface DeckDefinition {
  id: string
  name: string
  description: string
  cards: PlayingCardDefinition[]
  modifiers: DeckModifiers
  effects?: Effect[]
}

export interface DeckModifiers {
  maxDiscards?: number
  maxHands?: number
  money?: number
  maxJokers?: number
  maxConsumables?: number
  handSizeModifier?: number
  maxInterest?: number
  startingVouchers?: VoucherType[]
  startingTarotCards?: number
  startingTarotTypes?: TarotCardDefinition['tarotType'][]
}
