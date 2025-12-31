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

const gameState: GameState = {
  allowedJokerFlags: [],
  consumables: [],
  consumablesUsed: [],
  discardsPlayed: 0,
  fullDeck: [],
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
    baseRerollPrice: 5,
    cardsForSale: [],
    celestialMultiplier: 1,
    guaranteedForSaleItems: [],
    maxCardsForSale: 2,
    maxVouchersForSale: 0,
    openPackState: null,
    packsForSale: [],
    playingCard: {
      multiplier: 0,
      editionBaseChance: 0.04,
      enchantmentBaseChance: 0.4,
      chipBaseChance: 0.2,
      editionWeights: {
        holographic: 0.35,
        foil: 0.5,
        polychrome: 0.15,
      },
    },
    priceMultiplier: 1,
    rerollsUsed: 0,
    selectedCardId: null,
    tarotCard: {
      multiplier: 1,
    },
    joker: {
      multiplier: 1,
      editionWeights: {
        holographic: 0.014,
        foil: 0.02,
        polychrome: 0.003,
        negative: 0.003,
        normal: 0.96,
      },
    },
    voucher: null,
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
  tags: [],
  totalScore: 0,
  vouchers: [],
}

export const defaultGameState = {
  ...gameState,
  fullDeck: initialDeckStates(gameState).pokerDeck,
}
