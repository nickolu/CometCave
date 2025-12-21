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
  royalFlush: HandState
  flushHouse: HandState
  fiveOfAKind: HandState
  flushFive: HandState
}

export interface HandState {
  timesPlayed: number
  level: number
  hand: PokerHand
}

export interface PokerHand {
  name: string
  baseChips: number
  multIncreasePerLevel: number
  chipIncreasePerLevel: number
  baseMult: number
  isSecret: boolean
}
