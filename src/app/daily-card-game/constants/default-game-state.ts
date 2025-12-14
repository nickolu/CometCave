import { pokerDeck } from './decks/poker-deck'
import {
  fiveOfAKindHand,
  flushHand,
  flushHouseHand,
  fourOfAKindHand,
  fullHouseHand,
  highCardHand,
  pairHand,
  straightFlushHand,
  straightHand,
  threeOfAKindHand,
  twoPairHand,
} from './hands'
import type { GameState, PokerHand, HandState } from '@/app/daily-card-game/domain/types'

const getDefaultHandState = (hand: PokerHand): HandState => ({
  timesPlayed: 0,
  level: 0,
  hand,
})

export const defaultGameState: GameState = {
  gamePhase: 'mainMenu',
  gamePlayState: {
    jokers: [],
    dealtCards: [],
    selectedCardIds: [],
    remainingDeck: pokerDeck,
    score: {
      chips: 0,
      mult: 0,
    },
    remainingHands: 4,
    remainingDiscards: 3,
  },
  handsPlayed: 0,
  maxConsumables: 0,
  maxJokers: 0,
  money: 0,
  tags: [],
  ouchersUsed: [],
  consumables: [],
  discardsPlayed: 0,
  fullDeck: pokerDeck,
  pokerHands: {
    highCard: getDefaultHandState(highCardHand),
    pair: getDefaultHandState(pairHand),
    twoPair: getDefaultHandState(twoPairHand),
    threeOfAKind: getDefaultHandState(threeOfAKindHand),
    straight: getDefaultHandState(straightHand),
    flush: getDefaultHandState(flushHand),
    fullHouse: getDefaultHandState(fullHouseHand),
    fourOfAKind: getDefaultHandState(fourOfAKindHand),
    straightFlush: getDefaultHandState(straightFlushHand),
    flushHouse: getDefaultHandState(flushHouseHand),
    fiveOfAKind: getDefaultHandState(fiveOfAKindHand),
  },
  rounds: [],
  shopState: {
    cardsForSale: [],
    packsForSale: [],
    vouchersForSale: [],
    rerollsUsed: 0,
    rerollPrice: 0,
    modifiers: {
      maxCardsForSale: 0,
      maxVouchersForSale: 0,
      baseRerollPrice: 0,
    },
  },
  stake: {
    disableSmallBlindReward: false,
    enableScaleFaster1: false,
    enableEternalJokers: false,
    enableFewerDiscards: false,
    enableScaleFaster2: false,
    enablePerishableJokers: false,
    enableRentableJokers: false,
  },
}
