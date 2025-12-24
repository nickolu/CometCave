import { cardValuePriority, suitPriority } from '@/app/daily-card-game/domain/hand/constants'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'

export const rankCardsByValueAndSuit = (cards: PlayingCardState[]): PlayingCardState[] => {
  return cards.sort((a, b) => {
    const aCard = playingCards[a.playingCardId]
    const bCard = playingCards[b.playingCardId]
    const aCardValuePriority = cardValuePriority[aCard.value]
    const bCardValuePriority = cardValuePriority[bCard.value]
    if (aCardValuePriority !== bCardValuePriority) {
      return bCardValuePriority - aCardValuePriority
    }
    return suitPriority[aCard.suit] - suitPriority[bCard.suit]
  })
}

export const findAllPairs = (cards: PlayingCardState[]): PlayingCardState[][] => {
  const pairs: PlayingCardState[][] = []
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (
        playingCards[cards[i].playingCardId].value === playingCards[cards[j].playingCardId].value
      ) {
        pairs.push([cards[i], cards[j]])
      }
    }
  }
  return pairs
}

export const rankPairsByValueAndSuit = (pairs: PlayingCardState[][]): PlayingCardState[][] => {
  return pairs.sort((a, b) => {
    const aCard = playingCards[a[0].playingCardId]
    const bCard = playingCards[b[0].playingCardId]
    const aCardValuePriority = cardValuePriority[aCard.value]
    const bCardValuePriority = cardValuePriority[bCard.value]
    if (aCardValuePriority !== bCardValuePriority) {
      return aCardValuePriority - bCardValuePriority
    }
    return suitPriority[aCard.suit] - suitPriority[bCard.suit]
  })
}

export const findAllThreeOfAKinds = (cards: PlayingCardState[]): PlayingCardState[][] => {
  const threeOfAKinds: PlayingCardState[][] = []
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (
          playingCards[cards[i].playingCardId].value ===
            playingCards[cards[j].playingCardId].value &&
          playingCards[cards[j].playingCardId].value === playingCards[cards[k].playingCardId].value
        ) {
          threeOfAKinds.push([cards[i], cards[j], cards[k]])
        }
      }
    }
  }
  return threeOfAKinds
}

export const findAllStraights = (
  cards: PlayingCardState[],
  minLength = 5
): PlayingCardState[][] => {
  const straights: PlayingCardState[][] = []

  for (let i = 0; i < cards.length - minLength + 1; i++) {
    let isStraight = true
    for (let j = i; j < i + minLength - 1; j++) {
      if (
        cardValuePriority[playingCards[cards[j].playingCardId].value] + 1 !==
        cardValuePriority[playingCards[cards[j + 1].playingCardId].value]
      ) {
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
  threeOfAKinds: PlayingCardState[][]
): PlayingCardState[][] => {
  return threeOfAKinds.sort((a, b) => {
    const aCard = playingCards[a[0].playingCardId]
    const bCard = playingCards[b[0].playingCardId]
    const aCardValuePriority = cardValuePriority[aCard.value]
    const bCardValuePriority = cardValuePriority[bCard.value]
    if (aCardValuePriority !== bCardValuePriority) {
      return aCardValuePriority - bCardValuePriority
    }
    return suitPriority[aCard.suit] - suitPriority[bCard.suit]
  })
}

// only poassible to have one four of a kind in a hand
export const findFourOfAKind = (cards: PlayingCardState[]): PlayingCardState[] => {
  let fourOfAKind: PlayingCardState[] = []
  const cardValues = cards.map(card => playingCards[card.playingCardId].value)
  for (const cardValue of cardValues) {
    const filteredCards = cards.filter(card => playingCards[card.playingCardId].value === cardValue)
    if (filteredCards.length === 4) {
      fourOfAKind = filteredCards
      break
    }
  }
  return fourOfAKind
}

export const areAllCardsSameSuit = (cards: PlayingCardState[]): boolean => {
  return cards.every(
    card => playingCards[card.playingCardId].suit === playingCards[cards[0].playingCardId].suit
  )
}
