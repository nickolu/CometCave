export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface PlayingCard {
  value: CardValue
  id: string
  baseChips: number
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  isHolographic: boolean
  isFoil: boolean
  modifier?: 'bonus' | 'mult' | 'gold' | 'glass'
  faceUp: boolean
  chip?: 'blue' | 'purple' | 'gold' | 'red'
  isFaceCard: boolean
}
