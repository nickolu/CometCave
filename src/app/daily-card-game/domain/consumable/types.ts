import type { PokerHand } from '@/app/daily-card-game/domain/hand/types'

export type Consumable = Celestial | Arcane

export interface Celestial {
  hand: PokerHand
}

export interface Arcane {
  rules: ArcaneRule[]
}

export interface ArcaneRule {
  name: string
}

export interface TagDefinition {
  name: string
}

export interface VoucherDefinition {
  name: string
}
