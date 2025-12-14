import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'

export interface PokerHandsState {
  highCard: HandState
  pair: HandState
  twoPair: HandState
  threeOfAKind: HandState
  straight: HandState
  flush: HandState
  fullHouse: HandState
  fourOfAKind: HandState
  straightFlush: HandState
  flushHouse: HandState
  fiveOfAKind: HandState
}

export interface HandState {
  timesPlayed: number
  level: number
  hand: PokerHand
}

export interface PokerHand {
  baseChips: number
  multIncreasePerLevel: number
  chipIncreasePerLevel: number
  baseMult: number
  isSecret: boolean
  isHand(cards: PlayingCard[]): [boolean, PlayingCard[]]
}
