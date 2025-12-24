export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface PlayingCardDefinition {
  value: CardValue
  id: string
  baseChips: number
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
}

export interface PlayingCardState {
  id: string
  playingCardId: PlayingCardDefinition['id']
  bonusChips: number
  flags: PlayingCardFlags
  isFaceUp: boolean
}

export interface PlayingCardFlags {
  isHolographic: boolean
  isFoil: boolean
  enchantment?: 'bonus' | 'mult' | 'gold' | 'glass'
  chip?: 'blue' | 'purple' | 'gold' | 'red'
}
