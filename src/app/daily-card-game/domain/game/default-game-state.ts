import { initialDeckStates } from '@/app/daily-card-game/domain/decks/decks'
import {
  fiveOfAKindHand,
  flushFiveHand,
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
} from '@/app/daily-card-game/domain/hand/hands'
import { initializeHand } from '@/app/daily-card-game/domain/hand/utils'
import { getCurrentDayAsSeedString } from '@/app/daily-card-game/domain/randomness'
import { initializeRounds } from '@/app/daily-card-game/domain/round/rounds'

import { GameState } from './types'

const gameSeed = getCurrentDayAsSeedString()

export const defaultGameState: GameState = {
  consumables: [],
  consumablesUsed: [],
  discardsPlayed: 0,
  fullDeck: initialDeckStates.pokerDeck,
  gamePhase: 'mainMenu',
  gamePlayState: {
    cardsToScore: [],
    dealtCards: [],
    isScoring: false,
    playedCardIds: [],
    remainingDeck: [],
    remainingHands: 4,
    remainingDiscards: 3,
    selectedCardIds: [],
    score: {
      chips: 0,
      mult: 0,
    },
    scoringEvents: [],
  },
  gameSeed: gameSeed,
  handsPlayed: 0,
  jokers: [],
  maxConsumables: 2,
  maxJokers: 5,
  maxHands: 4,
  maxDiscards: 3,
  maxInterest: 5,
  money: 0,
  minimumMoney: 0,
  pokerHands: {
    highCard: initializeHand(highCardHand),
    pair: initializeHand(pairHand),
    twoPair: initializeHand(twoPairHand),
    threeOfAKind: initializeHand(threeOfAKindHand),
    straight: initializeHand(straightHand),
    flush: initializeHand(flushHand),
    fullHouse: initializeHand(fullHouseHand),
    fourOfAKind: initializeHand(fourOfAKindHand),
    straightFlush: initializeHand(straightFlushHand),
    flushHouse: initializeHand(flushHouseHand),
    fiveOfAKind: initializeHand(fiveOfAKindHand),
    flushFive: initializeHand(flushFiveHand),
  },
  rounds: initializeRounds(gameSeed),
  roundIndex: 1,
  shopState: {
    selectedCardId: null,
    openPackState: null,
    cardsForSale: [],
    packsForSale: [],
    rerollsUsed: 0,
    baseRerollPrice: 5,
    celestialMultiplier: 1,
    playingCardMultiplier: 0,
    tarotCardMultiplier: 1,
    maxCardsForSale: 0,
    maxVouchersForSale: 0,
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
  staticRules: {
    numberOfCardsRequiredForFlushAndStraight: 5,
    areAllCardsFaceCards: false,
    allowDuplicateJokersInShop: false,
  },
  totalScore: 0,
}
