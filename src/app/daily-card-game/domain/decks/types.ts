import { PlayingCardDefinition } from '@/app/daily-card-game/domain/playing-card/types'

export interface DeckDefinition {
  id: string
  name: string
  description: string
  cards: PlayingCardDefinition[]
  modifiers: DeckModifiers
}

export interface DeckModifiers {
  maxDiscards?: number
  maxHands?: number
  money?: number
  maxJokers?: number
  maxConsumables?: number
  handSizeModifier?: number
  maxInterest?: number
}
