import { CardValue, PlayingCard, PokerHand } from '../domain/types'

const cardValuePriority: Record<CardValue, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  J: 10,
  Q: 11,
  K: 12,
  A: 13,
}

const suitPriority: Record<PlayingCard['suit'], number> = {
  hearts: 1,
  diamonds: 2,
  clubs: 3,
  spades: 4,
}

const rankCardsByValueAndSuit = (cards: PlayingCard[]): PlayingCard[] => {
  return cards.sort((a, b) => {
    if (cardValuePriority[a.value] !== cardValuePriority[b.value]) {
      return cardValuePriority[a.value] - cardValuePriority[b.value]
    }
    return suitPriority[a.suit] - suitPriority[b.suit]
  })
}

export const highCardHand: PokerHand = {
  baseChips: 100,
  multIncreasePerLevel: 1,
  chipIncreasePerLevel: 1,
  baseMult: 1,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const rankedCards = rankCardsByValueAndSuit(cards)
    return [true, [rankedCards[0]]]
  },
}

const findAllPairs = (cards: PlayingCard[]): PlayingCard[][] => {
  const pairs: PlayingCard[][] = []
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].value === cards[j].value) {
        pairs.push([cards[i], cards[j]])
      }
    }
  }
  return pairs
}

const rankPairsByValueAndSuit = (pairs: PlayingCard[][]): PlayingCard[][] => {
  return pairs.sort((a, b) => {
    if (cardValuePriority[a[0].value] !== cardValuePriority[b[0].value]) {
      return cardValuePriority[a[0].value] - cardValuePriority[b[0].value]
    }
    return suitPriority[a[0].suit] - suitPriority[b[0].suit]
  })
}

const findAllThreeOfAKinds = (cards: PlayingCard[]): PlayingCard[][] => {
  const threeOfAKinds: PlayingCard[][] = []
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (cards[i].value === cards[j].value && cards[j].value === cards[k].value) {
          threeOfAKinds.push([cards[i], cards[j], cards[k]])
        }
      }
    }
  }
  return threeOfAKinds
}

const findAllStraights = (cards: PlayingCard[]): PlayingCard[][] => {
  const straights: PlayingCard[][] = []
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardValuePriority[cards[i].value] + 1 === cardValuePriority[cards[j].value]) {
        straights.push([cards[i], cards[j]])
      }
    }
  }
  return straights
}

const rankThreeOfAKindsByValueAndSuit = (threeOfAKinds: PlayingCard[][]): PlayingCard[][] => {
  return threeOfAKinds.sort((a, b) => {
    if (cardValuePriority[a[0].value] !== cardValuePriority[b[0].value]) {
      return cardValuePriority[a[0].value] - cardValuePriority[b[0].value]
    }
    return suitPriority[a[0].suit] - suitPriority[b[0].suit]
  })
}

// only poassible to have one four of a kind in a hand
const findFourOfAKind = (cards: PlayingCard[]): PlayingCard[] => {
  let fourOfAKind: PlayingCard[] = []
  const cardValues = cards.map(card => card.value)
  for (const cardValue of cardValues) {
    const filteredCards = cards.filter(card => card.value === cardValue)
    if (filteredCards.length === 4) {
      fourOfAKind = filteredCards
      break
    }
  }
  return fourOfAKind
}

const areAllCardsSameSuit = (cards: PlayingCard[]): boolean => {
  return cards.every(card => card.suit === cards[0].suit)
}

export const pairHand: PokerHand = {
  baseChips: 200,
  multIncreasePerLevel: 2,
  chipIncreasePerLevel: 2,
  baseMult: 2,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const pairs = findAllPairs(cards)
    if (pairs.length > 0) {
      const rankedPairs = rankPairsByValueAndSuit(pairs)
      return [true, rankedPairs[0]]
    }
    return [false, []]
  },
}

export const twoPairHand: PokerHand = {
  baseChips: 300,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 3,
  baseMult: 3,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const pairs = findAllPairs(cards)
    if (pairs.length >= 2) {
      const rankedPairs = rankPairsByValueAndSuit(pairs)
      return [true, rankedPairs[0].concat(rankedPairs[1])]
    }
    return [false, []]
  },
}

export const threeOfAKindHand: PokerHand = {
  baseChips: 400,
  multIncreasePerLevel: 4,
  chipIncreasePerLevel: 4,
  baseMult: 4,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const threeOfAKinds = findAllThreeOfAKinds(cards)
    if (threeOfAKinds.length > 0) {
      const rankedThreeOfAKinds = rankThreeOfAKindsByValueAndSuit(threeOfAKinds)
      return [true, rankedThreeOfAKinds[0]]
    }
    return [false, []]
  },
}

export const straightHand: PokerHand = {
  baseChips: 500,
  multIncreasePerLevel: 5,
  chipIncreasePerLevel: 5,
  baseMult: 5,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const straights = findAllStraights(cards)
    if (straights.length > 0) {
      return [true, straights[0]] // impossible for a hand to have more than one straight
    }
    return [false, []]
  },
}

export const flushHand: PokerHand = {
  baseChips: 600,
  multIncreasePerLevel: 6,
  chipIncreasePerLevel: 6,
  baseMult: 6,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const rankedCards = rankCardsByValueAndSuit(cards)
    const flush = rankedCards.filter(card => card.suit === rankedCards[0].suit)
    if (flush.length >= 5) {
      return [true, flush.slice(0, 5)]
    }
    return [false, []]
  },
}

export const fullHouseHand: PokerHand = {
  baseChips: 700,
  multIncreasePerLevel: 7,
  chipIncreasePerLevel: 7,
  baseMult: 7,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
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
        const rankedPairs = rankPairsByValueAndSuit(pairs)
        return [true, rankedThreeOfAKinds[0].concat(rankedPairs[0])]
      }
    }
    return [false, []]
  },
}

export const fourOfAKindHand: PokerHand = {
  baseChips: 800,
  multIncreasePerLevel: 8,
  chipIncreasePerLevel: 8,
  baseMult: 8,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const fourOfAKind = findFourOfAKind(cards)
    if (fourOfAKind.length > 0) {
      return [true, fourOfAKind]
    }
    return [false, []]
  },
}

export const straightFlushHand: PokerHand = {
  baseChips: 900,
  multIncreasePerLevel: 9,
  chipIncreasePerLevel: 9,
  baseMult: 9,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    const straights = findAllStraights(cards)
    if (straights.length > 0 && areAllCardsSameSuit(cards)) {
      return [true, straights[0]]
    }
    return [false, []]
  },
}

export const flushHouseHand: PokerHand = {
  baseChips: 1000,
  multIncreasePerLevel: 10,
  chipIncreasePerLevel: 10,
  baseMult: 10,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards]
  },
}

export const fiveOfAKindHand: PokerHand = {
  baseChips: 1100,
  multIncreasePerLevel: 11,
  chipIncreasePerLevel: 11,
  baseMult: 11,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards]
  },
}
