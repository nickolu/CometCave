import { cardValuePriority, suitPriority } from '@/app/daily-card-game/domain/hand/constants'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'

import { PokerHandDefinition, PokerHandState } from './types'

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
  if (cards.length < minLength) return []

  type Priority = number

  const getPriority = (card: PlayingCardState): Priority =>
    cardValuePriority[playingCards[card.playingCardId].value]

  const isBetterSameValueCard = (a: PlayingCardState, b: PlayingCardState): boolean => {
    // Prefer the card with the higher suitPriority for deterministic selection.
    return (
      suitPriority[playingCards[a.playingCardId].suit] >
      suitPriority[playingCards[b.playingCardId].suit]
    )
  }

  const buildBestCardByPriority = (input: PlayingCardState[]): Map<Priority, PlayingCardState> => {
    const best = new Map<Priority, PlayingCardState>()
    for (const card of input) {
      const pr = getPriority(card)
      const existing = best.get(pr)
      if (!existing || isBetterSameValueCard(card, existing)) {
        best.set(pr, card)
      }
    }

    // Ace can also be used as "low" in A-2-3-4-5, so we mirror it at priority 0.
    const acePr = cardValuePriority.A
    const aceCard = best.get(acePr)
    if (aceCard) best.set(0, aceCard)

    return best
  }

  const bestCardByPriority = buildBestCardByPriority(cards)
  const prioritiesAsc = Array.from(bestCardByPriority.keys()).sort((a, b) => a - b)

  // Collect all consecutive runs, then take sliding windows of `minLength`.
  const found: Array<{ high: Priority; cards: PlayingCardState[] }> = []

  const pushWindowsForRun = (run: Priority[]) => {
    if (run.length < minLength) return
    for (let start = 0; start <= run.length - minLength; start++) {
      const window = run.slice(start, start + minLength)
      const straightCards = window.map(pr => bestCardByPriority.get(pr)!).filter(Boolean)
      found.push({ high: window[window.length - 1], cards: straightCards })
    }
  }

  let currentRun: Priority[] = []
  for (const pr of prioritiesAsc) {
    if (currentRun.length === 0) {
      currentRun = [pr]
      continue
    }

    const prev = currentRun[currentRun.length - 1]
    if (pr === prev + 1) {
      currentRun.push(pr)
    } else {
      pushWindowsForRun(currentRun)
      currentRun = [pr]
    }
  }
  pushWindowsForRun(currentRun)

  // Highest straight first (important because callers use [0]).
  found.sort((a, b) => b.high - a.high)
  return found.map(s => s.cards)
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

export const initializeHand = (hand: PokerHandDefinition): PokerHandState => ({
  timesPlayed: 0,
  level: 0,
  handId: hand.id,
})
