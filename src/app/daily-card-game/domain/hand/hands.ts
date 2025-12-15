import { PokerHand } from '@/app/daily-card-game/domain/hand/types'
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

export const highCardHand: PokerHand = {
  baseChips: 100,
  multIncreasePerLevel: 1,
  chipIncreasePerLevel: 1,
  baseMult: 1,
  isSecret: false,
}

export const pairHand: PokerHand = {
  baseChips: 200,
  multIncreasePerLevel: 2,
  chipIncreasePerLevel: 2,
  baseMult: 2,
  isSecret: false,
}

export const twoPairHand: PokerHand = {
  baseChips: 300,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 3,
  baseMult: 3,
  isSecret: false,
}

export const threeOfAKindHand: PokerHand = {
  baseChips: 400,
  multIncreasePerLevel: 4,
  chipIncreasePerLevel: 4,
  baseMult: 4,
  isSecret: false,
}

export const straightHand: PokerHand = {
  baseChips: 500,
  multIncreasePerLevel: 5,
  chipIncreasePerLevel: 5,
  baseMult: 5,
  isSecret: false,
}

export const flushHand: PokerHand = {
  baseChips: 600,
  multIncreasePerLevel: 6,
  chipIncreasePerLevel: 6,
  baseMult: 6,
  isSecret: false,
}

export const fullHouseHand: PokerHand = {
  baseChips: 700,
  multIncreasePerLevel: 7,
  chipIncreasePerLevel: 7,
  baseMult: 7,
  isSecret: false,
}

export const fourOfAKindHand: PokerHand = {
  baseChips: 800,
  multIncreasePerLevel: 8,
  chipIncreasePerLevel: 8,
  baseMult: 8,
  isSecret: false,
}

export const straightFlushHand: PokerHand = {
  baseChips: 900,
  multIncreasePerLevel: 9,
  chipIncreasePerLevel: 9,
  baseMult: 9,
  isSecret: false,
}

export const flushHouseHand: PokerHand = {
  baseChips: 1000,
  multIncreasePerLevel: 10,
  chipIncreasePerLevel: 10,
  baseMult: 10,
  isSecret: true,
}

export const fiveOfAKindHand: PokerHand = {
  baseChips: 1100,
  multIncreasePerLevel: 11,
  chipIncreasePerLevel: 11,
  baseMult: 11,
  isSecret: true,
}

export const flushFiveHand: PokerHand = {
  baseChips: 1200,
  multIncreasePerLevel: 12,
  chipIncreasePerLevel: 12,
  baseMult: 12,
  isSecret: true,
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
  if (cards.every(card => card.value === cards[0].value)) {
    return [true, cards]
  }
  return [false, []]
}

export const checkHandForFlushFive: HandCheckFunction = cards => {
  if (cards.every(card => card.value === cards[0].value && card.suit === cards[0].suit)) {
    return [true, cards]
  }
  return [false, []]
}
