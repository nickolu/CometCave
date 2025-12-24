import { CardValue, PlayingCardDefinition } from '@/app/daily-card-game/domain/playing-card/types'

import { PokerHandsState } from './types'

export const cardValuePriority: Record<CardValue, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  J: 10,
  Q: 11,
  K: 12,
  A: 13,
}

export const suitPriority: Record<PlayingCardDefinition['suit'], number> = {
  hearts: 1,
  diamonds: 2,
  clubs: 3,
  spades: 4,
}

export const handPriority: Record<keyof PokerHandsState, number> = {
  highCard: 1,
  pair: 2,
  twoPair: 3,
  threeOfAKind: 4,
  straight: 5,
  flush: 6,
  fullHouse: 7,
  fourOfAKind: 8,
  straightFlush: 9,
  royalFlush: 10,
  flushFive: 11,
  flushHouse: 12,
  fiveOfAKind: 13,
}
