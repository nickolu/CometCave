import { initialDeckStates } from '@/app/daily-card-game/domain/decks/decks'
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
import type { PokerHandDefinition, PokerHandState } from '@/app/daily-card-game/domain/hand/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import type { JokerDefinition, JokerState } from '@/app/daily-card-game/domain/joker/types'
import { uuid } from '@/app/daily-card-game/domain/randomness'
import { rounds } from '@/app/daily-card-game/domain/round/rounds'

const getDefaultHandState = (hand: PokerHandDefinition): PokerHandState => ({
  timesPlayed: 0,
  level: 0,
  handId: hand.id,
})

const getDefaultJokerState = (joker: JokerDefinition): JokerState => ({
  id: uuid(),
  jokerId: joker.id,
  flags: {
    isRentable: false,
    isPerishable: false,
    isEternal: false,
    isHolographic: false,
    isFoil: false,
    isNegative: false,
    faceUp: false,
  },
})

export const defaultGameState: GameState = {
  consumables: [],
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
  gameSeed: 'default',
  handsPlayed: 0,
  jokers: [
    getDefaultJokerState(jokers['jokerStencil']),
    getDefaultJokerState(jokers['fourFingersJoker']),
  ],
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
  roundIndex: 1,
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
  staticRules: {
    numberOfCardsRequiredForFlushAndStraight: 5,
    areAllCardsFaceCards: false,
  },
  tags: [],
  totalScore: 0,
  vouchersUsed: [],
}
