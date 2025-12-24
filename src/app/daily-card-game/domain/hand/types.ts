export interface PokerHandsState {
  highCard: PokerHandState
  pair: PokerHandState
  twoPair: PokerHandState
  threeOfAKind: PokerHandState
  straight: PokerHandState
  flush: PokerHandState
  fullHouse: PokerHandState
  fourOfAKind: PokerHandState
  straightFlush: PokerHandState
  royalFlush: PokerHandState
  flushHouse: PokerHandState
  fiveOfAKind: PokerHandState
  flushFive: PokerHandState
}

export interface PokerHandState {
  timesPlayed: number
  level: number
  handId: keyof PokerHandsState
}

export interface PokerHandDefinition {
  id: keyof PokerHandsState
  name: string
  baseChips: number 
  multIncreasePerLevel: number
  chipIncreasePerLevel: number
  baseMult: number
  isSecret: boolean
}
