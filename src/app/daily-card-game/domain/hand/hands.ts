import { StaticRulesState } from '@/app/daily-card-game/domain/game/types'
import { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import {
  areAllCardsSameSuit,
  findAllPairs,
  findAllStraights,
  findAllThreeOfAKinds,
  findFourOfAKind,
  rankCardsByValueAndSuit,
  rankPairsByValueAndSuit,
  rankThreeOfAKindsByValueAndSuit,
} from '@/app/daily-card-game/domain/hand/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import {
  PlayingCardDefinition,
  PlayingCardState,
} from '@/app/daily-card-game/domain/playing-card/types'

import { handPriority } from './constants'

export const highCardHand: PokerHandDefinition = {
  id: 'highCard',
  baseChips: 5,
  baseMult: 1,
  chipIncreasePerLevel: 10,
  isSecret: false,
  multIncreasePerLevel: 1,
  name: 'High Card',
}

export const pairHand: PokerHandDefinition = {
  id: 'pair',
  baseChips: 10,
  baseMult: 2,
  chipIncreasePerLevel: 15,
  isSecret: false,
  multIncreasePerLevel: 1,
  name: 'Pair',
}

export const twoPairHand: PokerHandDefinition = {
  id: 'twoPair',
  baseChips: 20,
  baseMult: 2,
  chipIncreasePerLevel: 20,
  isSecret: false,
  multIncreasePerLevel: 1,
  name: 'Two Pair',
}

export const threeOfAKindHand: PokerHandDefinition = {
  id: 'threeOfAKind',
  baseChips: 30,
  baseMult: 3,
  chipIncreasePerLevel: 20,
  isSecret: false,
  multIncreasePerLevel: 2,
  name: 'Three of a Kind',
}

export const straightHand: PokerHandDefinition = {
  id: 'straight',
  baseChips: 30,
  baseMult: 4,
  chipIncreasePerLevel: 30,
  isSecret: false,
  multIncreasePerLevel: 3,
  name: 'Straight',
}

export const flushHand: PokerHandDefinition = {
  id: 'flush',
  baseChips: 35,
  baseMult: 4,
  chipIncreasePerLevel: 15,
  isSecret: false,
  multIncreasePerLevel: 2,
  name: 'Flush',
}

export const fullHouseHand: PokerHandDefinition = {
  id: 'fullHouse',
  baseChips: 40,
  baseMult: 4,
  chipIncreasePerLevel: 25,
  isSecret: false,
  multIncreasePerLevel: 2,
  name: 'Full House',
}

export const fourOfAKindHand: PokerHandDefinition = {
  id: 'fourOfAKind',
  baseChips: 60,
  baseMult: 7,
  chipIncreasePerLevel: 30,
  isSecret: false,
  multIncreasePerLevel: 3,
  name: 'Four of a Kind',
}

export const straightFlushHand: PokerHandDefinition = {
  id: 'straightFlush',
  baseChips: 100,
  baseMult: 8,
  chipIncreasePerLevel: 40,
  isSecret: false,
  multIncreasePerLevel: 4,
  name: 'Straight Flush',
}

export const royalFlushHand: PokerHandDefinition = {
  id: 'royalFlush',
  baseChips: 100,
  baseMult: 8,
  chipIncreasePerLevel: 40, // TODO: Add correct value
  isSecret: false,
  multIncreasePerLevel: 4, // TODO: Add correct value
  name: 'Flush House',
}

export const fiveOfAKindHand: PokerHandDefinition = {
  id: 'fiveOfAKind',
  baseChips: 120,
  baseMult: 12,
  chipIncreasePerLevel: 40, // TODO: Add correct value
  isSecret: true,
  multIncreasePerLevel: 3, // TODO: Add correct value
  name: 'Five of a Kind',
}

export const flushHouseHand: PokerHandDefinition = {
  id: 'flushHouse',
  baseChips: 140,
  baseMult: 14,
  chipIncreasePerLevel: 40,
  isSecret: true,
  multIncreasePerLevel: 4,
  name: 'Flush House',
}

export const flushFiveHand: PokerHandDefinition = {
  id: 'flushFive',
  baseChips: 160,
  baseMult: 16,
  chipIncreasePerLevel: 50,
  isSecret: true,
  multIncreasePerLevel: 3,
  name: 'Flush Five',
}

export const pokerHands: Record<PokerHandDefinition['id'], PokerHandDefinition> = {
  highCard: highCardHand,
  pair: pairHand,
  twoPair: twoPairHand,
  threeOfAKind: threeOfAKindHand,
  straight: straightHand,
  flush: flushHand,
  fullHouse: fullHouseHand,
  fourOfAKind: fourOfAKindHand,
  straightFlush: straightFlushHand,
  royalFlush: royalFlushHand,
  flushHouse: flushHouseHand,
  fiveOfAKind: fiveOfAKindHand,
  flushFive: flushFiveHand,
}

// returns if the card series contains target hand and the highest value matching cards for the hand
type HandCheckFunction<Args extends unknown[] = []> = (
  cards: PlayingCardState[],
  ...args: Args
) => [boolean, PlayingCardState[]]

export const checkHandForHighCard: HandCheckFunction = cards => {
  const rankedCards = rankCardsByValueAndSuit(cards)
  return [true, [rankedCards[0]]]
}

export const checkHandForPair: HandCheckFunction = cards => {
  const pairs = findAllPairs(cards)
  if (pairs.length > 0) {
    const rankedPairs = rankPairsByValueAndSuit(pairs)
    return [true, rankedPairs[0]]
  }
  return [false, []]
}

export const checkHandForTwoPair: HandCheckFunction = cards => {
  const pairs = findAllPairs(cards)
  if (pairs.length >= 2) {
    const rankedPairs = rankPairsByValueAndSuit(pairs)
    return [true, rankedPairs[0].concat(rankedPairs[1])]
  }
  return [false, []]
}

export const checkHandForThreeOfAKind: HandCheckFunction = cards => {
  const threeOfAKinds = findAllThreeOfAKinds(cards)
  if (threeOfAKinds.length > 0) {
    const rankedThreeOfAKinds = rankThreeOfAKindsByValueAndSuit(threeOfAKinds)
    return [true, rankedThreeOfAKinds[0]]
  }
  return [false, []]
}

export const checkHandForStraight: HandCheckFunction<[StaticRulesState]> = (cards, staticRules) => {
  const straights = findAllStraights(cards, staticRules.numberOfCardsRequiredForFlushAndStraight)
  if (straights.length > 0) {
    return [true, straights[0]]
  }
  return [false, []]
}

export const checkHandForFlush: HandCheckFunction<[StaticRulesState]> = (cards, staticRules) => {
  const rankedCards = rankCardsByValueAndSuit(cards)
  const flush = rankedCards.filter(
    card =>
      playingCards[card.playingCardId].suit === playingCards[rankedCards[0].playingCardId].suit
  )
  if (flush.length >= staticRules.numberOfCardsRequiredForFlushAndStraight) {
    return [true, flush.slice(0, staticRules.numberOfCardsRequiredForFlushAndStraight)]
  }
  return [false, []]
}

export const checkHandForFullHouse: HandCheckFunction = cards => {
  const threeOfAKinds = findAllThreeOfAKinds(cards)
  if (threeOfAKinds.length > 0) {
    const rankedThreeOfAKinds = rankThreeOfAKindsByValueAndSuit(threeOfAKinds)
    const pairs = findAllPairs(
      cards.filter(
        card =>
          card !== rankedThreeOfAKinds[0][0] &&
          card !== rankedThreeOfAKinds[0][1] &&
          card !== rankedThreeOfAKinds[0][2]
      )
    )
    if (pairs.length > 0) {
      return [true, rankedThreeOfAKinds[0].concat(pairs[0])]
    }
  }
  return [false, []]
}

export const checkHandForFourOfAKind: HandCheckFunction = cards => {
  const fourOfAKind = findFourOfAKind(cards)
  if (fourOfAKind.length > 0) {
    return [true, fourOfAKind]
  }
  return [false, []]
}

export const checkHandForStraightFlush: HandCheckFunction<[StaticRulesState]> = (
  cards,
  staticRules
) => {
  const straights = findAllStraights(cards, staticRules.numberOfCardsRequiredForFlushAndStraight)
  if (straights.length > 0) {
    const flush = areAllCardsSameSuit(straights[0])
    if (flush) {
      return [true, straights[0]]
    }
  }
  return [false, []]
}

const faceCardValues = ['J', 'Q', 'K']
const isFaceCard = (card: PlayingCardDefinition): boolean => {
  return faceCardValues.includes(card.value)
}

export const checkHandForRoyalFlush: HandCheckFunction<[StaticRulesState]> = (
  cards,
  staticRules
) => {
  const straights = findAllStraights(cards, staticRules.numberOfCardsRequiredForFlushAndStraight)
  if (straights.length > 0) {
    const flush = areAllCardsSameSuit(straights[0])
    const isRoyalFlush =
      staticRules.areAllCardsFaceCards ||
      straights[0].every(card => isFaceCard(playingCards[card.playingCardId]))
    if (flush && isRoyalFlush) {
      return [true, straights[0]]
    }
  }
  return [false, []]
}

export const checkHandForFlushHouse: HandCheckFunction<[StaticRulesState]> = (
  cards,
  staticRules
) => {
  const straights = findAllStraights(cards, staticRules.numberOfCardsRequiredForFlushAndStraight)
  if (straights.length > 0) {
    const flush = areAllCardsSameSuit(straights[0])
    if (flush) {
      return [true, straights[0]]
    }
  }
  return [false, []]
}

export const checkHandForFiveOfAKind: HandCheckFunction<[StaticRulesState]> = cards => {
  if (
    cards.length === 5 &&
    cards.every(
      card => playingCards[card.playingCardId].value === playingCards[cards[0].playingCardId].value
    )
  ) {
    return [true, cards]
  }
  return [false, []]
}

export const checkHandForFlushFive: HandCheckFunction = cards => {
  if (
    cards.length === 5 &&
    cards.every(
      card =>
        playingCards[card.playingCardId].value === playingCards[cards[0].playingCardId].value &&
        playingCards[card.playingCardId].suit === playingCards[cards[0].playingCardId].suit
    )
  ) {
    return [true, cards]
  }
  return [false, []]
}

const handCheckFunctions: Record<
  PokerHandDefinition['id'],
  HandCheckFunction | HandCheckFunction<[StaticRulesState]>
> = {
  highCard: checkHandForHighCard,
  pair: checkHandForPair,
  twoPair: checkHandForTwoPair,
  threeOfAKind: checkHandForThreeOfAKind,
  straight: checkHandForStraight,
  flush: checkHandForFlush,
  fullHouse: checkHandForFullHouse,
  fourOfAKind: checkHandForFourOfAKind,
  straightFlush: checkHandForStraightFlush,
  royalFlush: checkHandForRoyalFlush,
  flushHouse: checkHandForFlushHouse,
  fiveOfAKind: checkHandForFiveOfAKind,
  flushFive: checkHandForFlushFive,
}

// type guard to check if a string is a valid poker hand name
const isPokerHandName = (name: string): name is PokerHandDefinition['id'] => {
  return name in handCheckFunctions
}

export const findHighestPriorityHand = (
  cards: PlayingCardState[],
  staticRules: StaticRulesState
): { hand: PokerHandDefinition['id']; handCards: PlayingCardState[] } => {
  let bestHand: PokerHandDefinition['id'] = 'highCard'
  let bestHandCards: PlayingCardState[] = checkHandForHighCard(cards)[1]
  for (const hand of Object.keys(handCheckFunctions)) {
    if (!isPokerHandName(hand)) continue

    const [isHand, handCards] = handCheckFunctions[hand](cards, staticRules)

    if (isHand && handPriority[hand] > handPriority[bestHand]) {
      bestHand = hand
      bestHandCards = handCards
    }
  }
  return { hand: bestHand, handCards: bestHandCards }
}
