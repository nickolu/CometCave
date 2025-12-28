import type { Effect } from '@/app/daily-card-game/domain/events/types'

export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface PlayingCardDefinition {
  value: CardValue
  id: string
  baseChips: number
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  effects: Effect[]
}

export interface PlayingCardState {
  id: string
  playingCardId: PlayingCardDefinition['id']
  bonusChips: number
  flags: PlayingCardFlags
  isFaceUp: boolean
}

export interface PlayingCardFlags {
  edition: 'holographic' | 'foil' | 'polychrome' | 'normal'
  enchantment: 'bonus' | 'mult' | 'gold' | 'glass' | 'lucky' | 'steel' | 'stone' | 'wild' | 'none'
  seal: 'blue' | 'purple' | 'gold' | 'red' | 'none'
}
