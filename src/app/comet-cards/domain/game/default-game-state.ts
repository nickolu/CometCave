import { decks, initialDeckStates } from '@/app/comet-cards/domain/decks/decks'
import { DeckDefinition } from '@/app/comet-cards/domain/decks/types'
import { spectralCards } from '@/app/comet-cards/domain/spectral/spectal-cards'
import { initializeSpectralCard } from '@/app/comet-cards/domain/spectral/utils'
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
} from '@/app/comet-cards/domain/hand/hands'
import { initializeHand } from '@/app/comet-cards/domain/hand/utils'
import { getCurrentDayAsSeedString } from '@/app/comet-cards/domain/randomness'
import { initializeRounds } from '@/app/comet-cards/domain/round/rounds'
import { generateStartingTarotCards } from '@/app/comet-cards/domain/decks/deck-consumables'
import { applyStartingVouchers } from '@/app/comet-cards/domain/voucher/deck-vouchers'

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
    cardIdsPlayedThisAnte: [],
    discardPileIds: [],
    drawPileIds: [],
    handIds: [],
    handTypesPlayedThisRound: [],
    handResults: [],
    handDealt: false,
    isDiscarding: false,
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
  selectedDeck: 'pokerDeck',
  jokers: [],
  maxConsumables: 2,
  maxJokers: 5,
  maxHands: 4,
  handSizeModifier: 0,
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
    isOpen: false,
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
    freeRerolls: 0,
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
    bossBlindRerolls: 0,
    bossBlindRerollCost: 0,
    telescopeActive: false,
    observatoryActive: false,
    spectralInArcanaPacks: false,
    probabilityMultiplier: 1,
    smearedSuits: false,
    allowStraightGaps: false,
    bossBlindDisabled: false,
  },
  tags: [],
  totalScore: 0n,
  vouchers: [],
}

export function applyDeckModifiers(state: GameState, deck: DeckDefinition): GameState {
  const { modifiers } = deck
  return {
    ...state,
    maxDiscards: state.maxDiscards + (modifiers.maxDiscards ?? 0),
    maxHands: state.maxHands + (modifiers.maxHands ?? 0),
    money: state.money + (modifiers.money ?? 0),
    maxJokers: state.maxJokers + (modifiers.maxJokers ?? 0),
    maxConsumables: state.maxConsumables + (modifiers.maxConsumables ?? 0),
    handSizeModifier: state.handSizeModifier + (modifiers.handSizeModifier ?? 0),
    maxInterest: state.maxInterest + (modifiers.maxInterest ?? 0),
    gamePlayState: {
      ...state.gamePlayState,
      remainingDiscards:
        state.gamePlayState.remainingDiscards + (modifiers.maxDiscards ?? 0),
      remainingHands: state.gamePlayState.remainingHands + (modifiers.maxHands ?? 0),
    },
  }
}

// Initialize the card registry and owned cards from the initial deck
const initialDeck = initialDeckStates(gameState).pokerDeck
const cards: Record<string, (typeof initialDeck)[number]> = {}
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

export function createGameStateWithDeck(deckId: string): GameState {
  const deck = decks[deckId]
  if (!deck) {
    throw new Error(`Unknown deck: ${deckId}`)
  }

  const baseState: GameState = {
    ...gameState,
    selectedDeck: deckId,
  }

  let stateWithModifiers = applyDeckModifiers(baseState, deck)

  // Plasma Deck doubles all blind requirements
  if (deckId === 'plasmaDeck') {
    stateWithModifiers = {
      ...stateWithModifiers,
      rounds: initializeRounds(stateWithModifiers.gameSeed, 2n),
    }
  }

  // Apply starting vouchers
  if (deck.modifiers.startingVouchers?.length) {
    stateWithModifiers = applyStartingVouchers(stateWithModifiers, deck.modifiers.startingVouchers)
  }

  // Apply starting tarot cards
  if (deck.modifiers.startingTarotCards || deck.modifiers.startingTarotTypes?.length) {
    const tarotCards = generateStartingTarotCards(
      stateWithModifiers.gameSeed,
      deck.modifiers.startingTarotCards ?? 0,
      deck.modifiers.startingTarotTypes,
    )
    stateWithModifiers = {
      ...stateWithModifiers,
      consumables: [...stateWithModifiers.consumables, ...tarotCards],
    }
  }

  // Ghost Deck starts with a Hex spectral card
  if (deckId === 'ghostDeck') {
    const hexCard = initializeSpectralCard(spectralCards.hex)
    stateWithModifiers = {
      ...stateWithModifiers,
      consumables: [...stateWithModifiers.consumables, hexCard as any],
    }
  }

  const deckCards = initialDeckStates(stateWithModifiers)[deckId]
  const deckCardMap: Record<string, (typeof deckCards)[number]> = {}
  const deckOwnedCardIds: string[] = []

  for (const card of deckCards) {
    deckCardMap[card.id] = card
    deckOwnedCardIds.push(card.id)
  }

  return {
    ...stateWithModifiers,
    cards: deckCardMap,
    ownedCardIds: deckOwnedCardIds,
  }
}
