import { cardValuePriority, suitPriority } from '@/app/daily-card-game/domain/hand/constants'
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'

export const rankCardsByValueAndSuit = (cards: PlayingCard[]): PlayingCard[] => {
  return cards.sort((a, b) => {
    if (cardValuePriority[a.value] !== cardValuePriority[b.value]) {
      return cardValuePriority[a.value] - cardValuePriority[b.value]
    }
    return suitPriority[a.suit] - suitPriority[b.suit]
  })
}

export const findAllPairs = (cards: PlayingCard[]): PlayingCard[][] => {
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

export const rankPairsByValueAndSuit = (pairs: PlayingCard[][]): PlayingCard[][] => {
  return pairs.sort((a, b) => {
    if (cardValuePriority[a[0].value] !== cardValuePriority[b[0].value]) {
      return cardValuePriority[a[0].value] - cardValuePriority[b[0].value]
    }
    return suitPriority[a[0].suit] - suitPriority[b[0].suit]
  })
}

export const findAllThreeOfAKinds = (cards: PlayingCard[]): PlayingCard[][] => {
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

export const findAllStraights = (cards: PlayingCard[], minLength = 5): PlayingCard[][] => {
  const straights: PlayingCard[][] = []

  for (let i = 0; i < cards.length - minLength + 1; i++) {
    let isStraight = true
    for (let j = i; j < i + minLength - 1; j++) {
      if (cardValuePriority[cards[j].value] + 1 !== cardValuePriority[cards[j + 1].value]) {
        isStraight = false
        break
      }
    }
    if (isStraight) {
      straights.push(cards.slice(i, i + minLength))
    }
  }
  return straights
}

export const rankThreeOfAKindsByValueAndSuit = (
  threeOfAKinds: PlayingCard[][]
): PlayingCard[][] => {
  return threeOfAKinds.sort((a, b) => {
    if (cardValuePriority[a[0].value] !== cardValuePriority[b[0].value]) {
      return cardValuePriority[a[0].value] - cardValuePriority[b[0].value]
    }
    return suitPriority[a[0].suit] - suitPriority[b[0].suit]
  })
}

// only poassible to have one four of a kind in a hand
export const findFourOfAKind = (cards: PlayingCard[]): PlayingCard[] => {
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

export const areAllCardsSameSuit = (cards: PlayingCard[]): boolean => {
  return cards.every(card => card.suit === cards[0].suit)
}
