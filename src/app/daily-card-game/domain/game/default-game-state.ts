import { pokerDeck } from '@/app/daily-card-game/domain/decks/poker-deck'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  fiveOfAKindHand,
  flushFiveHand,
  flushHand,
  flushHouseHand,
  fourOfAKindHand,
  fullHouseHand,
  highCardHand,
  pairHand,
  royalFlushHand,
  straightFlushHand,
  straightHand,
  threeOfAKindHand,
  twoPairHand,
} from '@/app/daily-card-game/domain/hand/hands'
import type { HandState, PokerHand } from '@/app/daily-card-game/domain/hand/types'
import { greedyJoker, jokerJoker } from '@/app/daily-card-game/domain/joker/jokers'
import { rounds } from '@/app/daily-card-game/domain/round/rounds'

const getDefaultHandState = (hand: PokerHand): HandState => ({
  timesPlayed: 0,
  level: 0,
  hand,
})

export const defaultGameState: GameState = {
  consumables: [],
  discardsPlayed: 0,
  fullDeck: pokerDeck,
  gamePhase: 'mainMenu',
  gamePlayState: {
    cardsToScore: [],
    dealtCards: [],
    isScoring: false,
    playedCardIds: [],
    remainingDeck: pokerDeck,
    remainingHands: 4,
    remainingDiscards: 3,
    selectedCardIds: [],
    score: {
      chips: 0,
      mult: 0,
    },
    scoringEvents: [],
  },
  gameSeed: 'default',
  handsPlayed: 0,
  jokers: [jokerJoker, greedyJoker],
  maxConsumables: 2,
  maxJokers: 5,
  maxHands: 4,
  maxDiscards: 3,
  money: 0,
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
    royalFlush: getDefaultHandState(royalFlushHand),
    flushHouse: getDefaultHandState(flushHouseHand),
    fiveOfAKind: getDefaultHandState(fiveOfAKindHand),
    flushFive: getDefaultHandState(flushFiveHand),
  },
  rounds,
  roundIndex: 0,
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
  tags: [],
  totalScore: 0,
  vouchersUsed: [],
}
