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
  name: 'High Card',
  baseChips: 100,
  multIncreasePerLevel: 1,
  chipIncreasePerLevel: 10,
  baseMult: 1,
  isSecret: false,
}

export const pairHand: PokerHand = {
  name: 'Pair',
  baseChips: 200,
  multIncreasePerLevel: 1,
  chipIncreasePerLevel: 15,
  baseMult: 2,
  isSecret: false,
}

export const twoPairHand: PokerHand = {
  name: 'Two Pair',
  baseChips: 300,
  multIncreasePerLevel: 1,
  chipIncreasePerLevel: 20,
  baseMult: 3,
  isSecret: false,
}

export const threeOfAKindHand: PokerHand = {
  name: 'Three of a Kind',
  baseChips: 400,
  multIncreasePerLevel: 2,
  chipIncreasePerLevel: 20,
  baseMult: 4,
  isSecret: false,
}

export const straightHand: PokerHand = {
  name: 'Straight',
  baseChips: 500,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 30,
  baseMult: 5,
  isSecret: false,
}

export const flushHand: PokerHand = {
  name: 'Flush',
  baseChips: 600,
  multIncreasePerLevel: 2,
  chipIncreasePerLevel: 15,
  baseMult: 6,
  isSecret: false,
}

export const fullHouseHand: PokerHand = {
  name: 'Full House',
  baseChips: 700,
  multIncreasePerLevel: 2,
  chipIncreasePerLevel: 25,
  baseMult: 7,
  isSecret: false,
}

export const fourOfAKindHand: PokerHand = {
  name: 'Four of a Kind',
  baseChips: 800,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 30,
  baseMult: 8,
  isSecret: false,
}

export const straightFlushHand: PokerHand = {
  name: 'Straight Flush',
  baseChips: 900,
  multIncreasePerLevel: 4,
  chipIncreasePerLevel: 40,
  baseMult: 9,
  isSecret: false,
}

export const flushHouseHand: PokerHand = {
  name: 'Flush House',
  baseChips: 1000,
  multIncreasePerLevel: 4,
  chipIncreasePerLevel: 40,
  baseMult: 10,
  isSecret: true,
}

export const fiveOfAKindHand: PokerHand = {
  name: 'Five of a Kind',
  baseChips: 1100,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 35,
  baseMult: 11,
  isSecret: true,
}

export const flushFiveHand: PokerHand = {
  name: 'Flush Five',
  baseChips: 1200,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 50,
  baseMult: 12,
  isSecret: true,
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
    return [true, straights[0]]
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
  flushHouse: checkHandForFlushHouse,
  fiveOfAKind: checkHandForFiveOfAKind,
  flushFive: checkHandForFlushFive,
}

// type guard to check if a string is a valid poker hand name
const isPokerHandName = (name: string): name is keyof PokerHandsState => {
  return name in handCheckFunctions
}

export const findHighestPriorityHand = (
  cards: PlayingCard[],
  minLengthForFlushAndStraight: number = 5
) => {
  console.log('cards', cards)
  let bestHand: keyof PokerHandsState = 'highCard'
  let bestHandCards: PlayingCard[] = checkHandForHighCard(cards)[1]
  for (const hand of Object.keys(handCheckFunctions)) {
    if (!isPokerHandName(hand)) continue

    const [isHand, handCards] = handCheckFunctions[hand](cards, minLengthForFlushAndStraight)
    console.log('isHand', isHand)
    console.log('handCards', handCards)

    if (isHand && handPriority[hand] > handPriority[bestHand]) {
      console.log('bestHand', bestHand)
      console.log('hand', hand)
      bestHand = hand
      bestHandCards = handCards
    }
  }
  return { hand: bestHand, handCards: bestHandCards }
}
