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
  cards: {}, // Will be populated below
  consumables: [],
  consumablesUsed: [],
  discardsPlayed: 0,
  gamePhase: 'mainMenu',
  gamePlayState: {
    cardsToScore: [],
    discardPileIds: [],
    drawPileIds: [],
    handIds: [],
    isScoring: false,
    playedCardIds: [],
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
  ownedCardIds: [], // Will be populated below
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

// Initialize the card registry and owned cards from the initial deck
const initialDeck = initialDeckStates(gameState).pokerDeck
const cards: Record<string, typeof initialDeck[number]> = {}
const ownedCardIds: string[] = []

for (const card of initialDeck) {
  cards[card.id] = card
  ownedCardIds.push(card.id)
}

export const defaultGameState: GameState = {
  ...gameState,
  cards,
  ownedCardIds,
}
