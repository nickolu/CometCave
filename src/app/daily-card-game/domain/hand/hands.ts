import { StaticRulesState } from '@/app/daily-card-game/domain/game/types'
import { PokerHand, PokerHandsState } from '@/app/daily-card-game/domain/hand/types'
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
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'

import { handPriority } from './constants'

export const highCardHand: PokerHand = {
  id: 'highCard',
  baseChips: 5,
  baseMult: 1,
  chipIncreasePerLevel: 10,
  isSecret: false,
  multIncreasePerLevel: 1,
  name: 'High Card',
}

export const pairHand: PokerHand = {
  id: 'pair',
  baseChips: 10,
  baseMult: 2,
  chipIncreasePerLevel: 15,
  isSecret: false,
  multIncreasePerLevel: 1,
  name: 'Pair',
}

export const twoPairHand: PokerHand = {
  id: 'twoPair',
  baseChips: 20,
  baseMult: 2,
  chipIncreasePerLevel: 20,
  isSecret: false,
  multIncreasePerLevel: 1,
  name: 'Two Pair',
}

export const threeOfAKindHand: PokerHand = {
  id: 'threeOfAKind',
  baseChips: 30,
  baseMult: 3,
  chipIncreasePerLevel: 20,
  isSecret: false,
  multIncreasePerLevel: 2,
  name: 'Three of a Kind',
}

export const straightHand: PokerHand = {
  id: 'straight',
  baseChips: 30,
  baseMult: 4,
  chipIncreasePerLevel: 30,
  isSecret: false,
  multIncreasePerLevel: 3,
  name: 'Straight',
}

export const flushHand: PokerHand = {
  id: 'flush',
  baseChips: 35,
  baseMult: 4,
  chipIncreasePerLevel: 15,
  isSecret: false,
  multIncreasePerLevel: 2,
  name: 'Flush',
}

export const fullHouseHand: PokerHand = {
  id: 'fullHouse',
  baseChips: 40,
  baseMult: 4,
  chipIncreasePerLevel: 25,
  isSecret: false,
  multIncreasePerLevel: 2,
  name: 'Full House',
}

export const fourOfAKindHand: PokerHand = {
  id: 'fourOfAKind',
  baseChips: 60,
  baseMult: 7,
  chipIncreasePerLevel: 30,
  isSecret: false,
  multIncreasePerLevel: 3,
  name: 'Four of a Kind',
}

export const straightFlushHand: PokerHand = {
  id: 'straightFlush',
  baseChips: 100,
  baseMult: 8,
  chipIncreasePerLevel: 40,
  isSecret: false,
  multIncreasePerLevel: 4,
  name: 'Straight Flush',
}

export const royalFlushHand: PokerHand = {
  id: 'royalFlush',
  baseChips: 100,
  baseMult: 8,
  chipIncreasePerLevel: 40, // TODO: Add correct value
  isSecret: false,
  multIncreasePerLevel: 4, // TODO: Add correct value
  name: 'Flush House',
}

export const fiveOfAKindHand: PokerHand = {
  id: 'fiveOfAKind',
  baseChips: 120,
  baseMult: 12,
  chipIncreasePerLevel: 40, // TODO: Add correct value
  isSecret: true,
  multIncreasePerLevel: 3, // TODO: Add correct value
  name: 'Five of a Kind',
}

export const flushHouseHand: PokerHand = {
  id: 'flushHouse',
  baseChips: 140,
  baseMult: 14,
  chipIncreasePerLevel: 40,
  isSecret: true,
  multIncreasePerLevel: 4,
  name: 'Flush House',
}

export const flushFiveHand: PokerHand = {
  id: 'flushFive',
  baseChips: 160,
  baseMult: 16,
  chipIncreasePerLevel: 50,
  isSecret: true,
  multIncreasePerLevel: 3,
  name: 'Flush Five',
}

export const hands: Record<keyof PokerHandsState, PokerHand> = {
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
  cards: PlayingCard[],
  ...args: Args
) => [boolean, PlayingCard[]]

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

export const checkHandForStraight: HandCheckFunction<[number]> = (cards, minLength) => {
  const straights = findAllStraights(cards, minLength)
  if (straights.length > 0) {
    return [true, straights[0]]
  }
  return [false, []]
}

export const checkHandForFlush: HandCheckFunction<[number]> = (cards, minLength) => {
  const rankedCards = rankCardsByValueAndSuit(cards)
  const flush = rankedCards.filter(card => card.suit === rankedCards[0].suit)
  if (flush.length >= minLength) {
    return [true, flush.slice(0, minLength)]
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

export const checkHandForStraightFlush: HandCheckFunction<[number]> = (cards, minLength) => {
  const straights = findAllStraights(cards, minLength)
  if (straights.length > 0) {
    const flush = areAllCardsSameSuit(straights[0])
    if (flush) {
      return [true, straights[0]]
    }
  }
  return [false, []]
}

export const checkHandForRoyalFlush: HandCheckFunction<[number]> = (cards, minLength) => {
  const straights = findAllStraights(cards, minLength)
  if (straights.length > 0) {
    const flush = areAllCardsSameSuit(straights[0])
    const isRoyalFlush = straights[0].every(card => card.isFaceCard)
    if (flush && isRoyalFlush) {
      return [true, straights[0]]
    }
  }
  return [false, []]
}

export const checkHandForFlushHouse: HandCheckFunction<[number]> = (cards, minLength) => {
  const straights = findAllStraights(cards, minLength)
  if (straights.length > 0) {
    const flush = areAllCardsSameSuit(straights[0])
    if (flush) {
      return [true, straights[0]]
    }
  }
  return [false, []]
}

export const checkHandForFiveOfAKind: HandCheckFunction<[number]> = cards => {
  if (cards.length === 5 && cards.every(card => card.value === cards[0].value)) {
    return [true, cards]
  }
  return [false, []]
}

export const checkHandForFlushFive: HandCheckFunction = cards => {
  if (
    cards.length === 5 &&
    cards.every(card => card.value === cards[0].value && card.suit === cards[0].suit)
  ) {
    return [true, cards]
  }
  return [false, []]
}

const handCheckFunctions: Record<
  keyof PokerHandsState,
  HandCheckFunction | HandCheckFunction<[number]>
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
const isPokerHandName = (name: string): name is keyof PokerHandsState => {
  return name in handCheckFunctions
}

export const findHighestPriorityHand = (cards: PlayingCard[], staticRules: StaticRulesState) => {
  let bestHand: keyof PokerHandsState = 'highCard'
  let bestHandCards: PlayingCard[] = checkHandForHighCard(cards)[1]
  for (const hand of Object.keys(handCheckFunctions)) {
    if (!isPokerHandName(hand)) continue

    const [isHand, handCards] = handCheckFunctions[hand](
      cards,
      staticRules.numberOfCardsRequiredForFlushAndStraight
    )

    if (isHand && handPriority[hand] > handPriority[bestHand]) {
      bestHand = hand
      bestHandCards = handCards
    }
  }
  return { hand: bestHand, handCards: bestHandCards }
}
