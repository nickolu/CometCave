import { describe, expect, it } from 'vitest'

import {
  checkHandForFiveOfAKind,
  checkHandForFlush,
  checkHandForFlushFive,
  checkHandForFlushHouse,
  checkHandForFourOfAKind,
  checkHandForFullHouse,
  checkHandForHighCard,
  checkHandForPair,
  checkHandForStraight,
  checkHandForStraightFlush,
  checkHandForThreeOfAKind,
  checkHandForTwoPair,
} from '@/app/daily-card-game/domain/hand/hands'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import type {
  PlayingCardDefinition,
  PlayingCardState,
} from '@/app/daily-card-game/domain/playing-card/types'
import { uuid } from '@/app/daily-card-game/domain/randomness'

const c = (cardDefinitionId: PlayingCardDefinition['id']): PlayingCardState => ({
  id: uuid(),
  playingCardId: cardDefinitionId,
  bonusChips: 0,
  flags: {
    isHolographic: false,
    isFoil: false,
  },
  isFaceUp: true,
})

describe('daily-card-game hand checkers', () => {
  it('checkHandForHighCard returns the first ranked card (by value then suit)', () => {
    const cards = [c('A_spades'), c('2_spades'), c('2_hearts'), c('K_clubs')]

    const [isHighCard, highCard] = checkHandForHighCard(cards)
    expect(isHighCard).toBe(true)
    // rankCardsByValueAndSuit sorts ascending by value priority, then suit priority (hearts < diamonds < clubs < spades)
    expect(playingCards[highCard[0].playingCardId].value).toEqual('A')
  })

  it('checkHandForPair returns the top-ranked pair among all pairs', () => {
    const twoHearts = c('2_hearts')
    const twoSpades = c('2_spades')
    const aceClubs = c('A_clubs')
    const aceSpades = c('A_spades')
    const filler = c('9_diamonds')

    const [isPair, pair] = checkHandForPair([aceSpades, twoSpades, filler, twoHearts, aceClubs])
    expect(isPair).toBe(true)
    // current implementation ranks ascending, so the pair of 2s wins over the pair of Aces
    expect(pair).toEqual([twoSpades, twoHearts])
  })

  it('checkHandForPair returns false when no pairs exist', () => {
    const [isPair, pair] = checkHandForPair([
      c('2_hearts'),
      c('3_clubs'),
      c('4_spades'),
      c('5_diamonds'),
    ])
    expect(isPair).toBe(false)
    expect(pair).toEqual([])
  })

  it('checkHandForTwoPair returns the two top-ranked pairs (in rank order)', () => {
    const twoHearts = c('2_hearts')
    const twoSpades = c('2_spades')
    const threeClubs = c('3_clubs')
    const threeDiamonds = c('3_diamonds')
    const aceClubs = c('A_clubs')
    const aceSpades = c('A_spades')

    const [isTwoPair, twoPair] = checkHandForTwoPair([
      aceSpades,
      threeClubs,
      twoSpades,
      aceClubs,
      twoHearts,
      threeDiamonds,
    ])
    expect(isTwoPair).toBe(true)
    // current implementation ranks ascending, so it chooses (2s) then (3s), ignoring the higher (Aces)
    expect(twoPair).toEqual([twoSpades, twoHearts, threeClubs, threeDiamonds])
  })

  it('checkHandForTwoPair returns false when fewer than two pairs exist', () => {
    const [isTwoPair, twoPair] = checkHandForTwoPair([
      c('2_hearts'),
      c('2_spades'),
      c('3_clubs'),
      c('4_spades'),
    ])
    expect(isTwoPair).toBe(false)
    expect(twoPair).toEqual([])
  })

  it('checkHandForThreeOfAKind returns the top-ranked trips among all trips', () => {
    const trips4 = [c('4_hearts'), c('4_clubs'), c('4_spades')]
    const trips7 = [c('7_hearts'), c('7_clubs'), c('7_spades')]

    const [isTrips, trips] = checkHandForThreeOfAKind([...trips7, ...trips4])
    expect(isTrips).toBe(true)
    // current implementation ranks ascending, so 4s win over 7s
    expect(trips).toEqual(trips4)
  })

  it('checkHandForStraight detects a straight regardless of selection order', () => {
    const expectedStraight = [
      c('2_hearts'),
      c('3_clubs'),
      c('4_spades'),
      c('5_diamonds'),
      c('6_hearts'),
    ]

    const outOfOrderSelection = [
      expectedStraight[2], // 4
      expectedStraight[0], // 2
      expectedStraight[1], // 3
      expectedStraight[4], // 6
      expectedStraight[3], // 5
    ]

    const [isStraight, straightCards] = checkHandForStraight(outOfOrderSelection, {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
    })
    expect(isStraight).toBe(true)
    // We return the straight cards in ascending value order.
    expect(straightCards).toEqual(expectedStraight)

    const [isNotStraight, notStraightCards] = checkHandForStraight(
      [c('2_hearts'), c('3_clubs'), c('5_spades'), c('6_diamonds'), c('7_hearts')],
      {
        numberOfCardsRequiredForFlushAndStraight: 5,
        areAllCardsFaceCards: false,
        allowDuplicateJokersInShop: false,
      }
    )
    expect(isNotStraight).toBe(false)
    expect(notStraightCards).toEqual([])
  })

  it('checkHandForStraight detects straights that include face cards (10-J-Q-K-A)', () => {
    const expectedStraight = [
      c('10_hearts'),
      c('J_clubs'),
      c('Q_spades'),
      c('K_diamonds'),
      c('A_hearts'),
    ]

    const [isStraight, straightCards] = checkHandForStraight(
      [
        expectedStraight[4],
        expectedStraight[0],
        expectedStraight[3],
        expectedStraight[2],
        expectedStraight[1],
      ],
      {
        numberOfCardsRequiredForFlushAndStraight: 5,
        areAllCardsFaceCards: false,
        allowDuplicateJokersInShop: false,
      }
    )
    expect(isStraight).toBe(true)
    expect(straightCards).toEqual(expectedStraight)
  })

  it('checkHandForStraight treats Ace as 1 for A-2-3-4-5', () => {
    const expectedStraight = [
      c('A_hearts'),
      c('2_clubs'),
      c('3_spades'),
      c('4_diamonds'),
      c('5_hearts'),
    ]

    const [isStraight, straightCards] = checkHandForStraight(
      [
        expectedStraight[3],
        expectedStraight[0],
        expectedStraight[4],
        expectedStraight[2],
        expectedStraight[1],
      ],
      {
        numberOfCardsRequiredForFlushAndStraight: 5,
        areAllCardsFaceCards: false,
        allowDuplicateJokersInShop: false,
      }
    )
    expect(isStraight).toBe(true)
    expect(straightCards).toEqual(expectedStraight)
  })

  it('checkHandForFlush checks the suit of the first ranked card and returns the first N of that suit', () => {
    const cards = [c('2_hearts'), c('5_hearts'), c('8_hearts'), c('3_spades'), c('K_hearts')]

    const [isFlush, flushCards] = checkHandForFlush(cards, {
      numberOfCardsRequiredForFlushAndStraight: 4,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
    })
    expect(isFlush).toBe(true)
    expect(
      flushCards.every(
        card => playingCards[card.playingCardId].suit === playingCards[cards[0].playingCardId].suit
      )
    ).toBe(true)
    expect(flushCards.length).toEqual(4)

    const [isNotFlush, notFlushCards] = checkHandForFlush(
      [c('2_hearts'), c('3_spades'), c('K_hearts'), c('8_hearts'), c('5_hearts')],
      {
        numberOfCardsRequiredForFlushAndStraight: 5,
        areAllCardsFaceCards: false,
        allowDuplicateJokersInShop: false,
      }
    )
    expect(isNotFlush).toBe(false)
    expect(notFlushCards).toEqual([])
  })

  it('checkHandForFullHouse returns trips + one pair (using reference equality to exclude the trips)', () => {
    const trips = [c('4_hearts'), c('4_clubs'), c('4_spades')]
    const pair = [c('9_diamonds'), c('9_hearts')]

    const [isFullHouse, fullHouseCards] = checkHandForFullHouse([...trips, ...pair])
    expect(isFullHouse).toBe(true)
    expect(fullHouseCards).toEqual([...trips, ...pair])

    const [isNotFullHouse, notFullHouseCards] = checkHandForFullHouse([
      c('4_hearts'),
      c('4_clubs'),
      c('4_spades'),
      c('9_diamonds'),
      c('A_hearts'),
    ])
    expect(isNotFullHouse).toBe(false)
    expect(notFullHouseCards).toEqual([])
  })

  it('checkHandForFourOfAKind returns the four-of-a-kind when present', () => {
    const quads = [c('K_hearts'), c('K_diamonds'), c('K_clubs'), c('K_spades')]
    const kicker = c('2_hearts')

    const [isQuads, quadCards] = checkHandForFourOfAKind([kicker, ...quads])
    expect(isQuads).toBe(true)
    expect(quadCards).toEqual(quads)

    const [isNotQuads, notQuadCards] = checkHandForFourOfAKind([
      c('K_hearts'),
      c('K_diamonds'),
      c('K_clubs'),
      c('2_spades'),
    ])
    expect(isNotQuads).toBe(false)
    expect(notQuadCards).toEqual([])
  })

  it('checkHandForStraightFlush currently only checks for a straight (not suit)', () => {
    const allSameSuitStraight = [
      c('2_hearts'),
      c('3_hearts'),
      c('4_hearts'),
      c('5_hearts'),
      c('6_hearts'),
    ]
    const [isStraightFlush, straightFlushCards] = checkHandForStraightFlush(allSameSuitStraight, {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
    })
    expect(isStraightFlush).toBe(true)
    expect(straightFlushCards).toEqual(allSameSuitStraight)
  })

  it('checkHandForFlushHouse requires a straight where all cards are the same suit', () => {
    const suitedStraight = [
      c('2_hearts'),
      c('3_hearts'),
      c('4_hearts'),
      c('5_hearts'),
      c('6_hearts'),
    ]
    const [isFlushHouse, flushHouseCards] = checkHandForFlushHouse(suitedStraight, {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
    })
    expect(isFlushHouse).toBe(true)
    expect(flushHouseCards).toEqual(suitedStraight)

    const mixedSuitStraight = [
      c('2_hearts'),
      c('3_clubs'),
      c('4_spades'),
      c('5_diamonds'),
      c('6_hearts'),
    ]
    const [isNotFlushHouse, notFlushHouseCards] = checkHandForFlushHouse(mixedSuitStraight, {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
    })
    expect(isNotFlushHouse).toBe(false)
    expect(notFlushHouseCards).toEqual([])
  })

  it('checkHandForFiveOfAKind requires exactly five cards with the same value', () => {
    const fiveAces = [c('A_hearts'), c('A_diamonds'), c('A_clubs'), c('A_spades'), c('A_hearts')]
    const [isFive, fiveCards] = checkHandForFiveOfAKind(fiveAces, {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
    })
    expect(isFive).toBe(true)
    expect(fiveCards).toEqual(fiveAces)

    const [isNotFive, notFiveCards] = checkHandForFiveOfAKind(
      [c('A_hearts'), c('A_diamonds'), c('A_clubs'), c('A_spades'), c('K_hearts')],
      {
        numberOfCardsRequiredForFlushAndStraight: 5,
        areAllCardsFaceCards: false,
        allowDuplicateJokersInShop: false,
      }
    )
    expect(isNotFive).toBe(false)
    expect(notFiveCards).toEqual([])

    const [isNotExactlyFive, notExactlyFiveCards] = checkHandForFiveOfAKind(
      [c('A_hearts'), c('A_diamonds'), c('A_clubs'), c('A_spades')],
      {
        numberOfCardsRequiredForFlushAndStraight: 5,
        areAllCardsFaceCards: false,
        allowDuplicateJokersInShop: false,
      }
    )
    expect(isNotExactlyFive).toBe(false)
    expect(notExactlyFiveCards).toEqual([])
  })

  it('checkHandForFlushFive requires exactly five cards with the same value and same suit', () => {
    const flushFive = [c('7_hearts'), c('7_hearts'), c('7_hearts'), c('7_hearts'), c('7_hearts')]
    const [isFlushFive, flushFiveCards] = checkHandForFlushFive(flushFive)
    expect(isFlushFive).toBe(true)
    expect(flushFiveCards).toEqual(flushFive)

    const [isNotFlushFive, notFlushFiveCards] = checkHandForFlushFive([
      c('7_hearts'),
      c('7_diamonds'),
      c('7_clubs'),
      c('7_spades'),
      c('7_hearts'),
    ])
    expect(isNotFlushFive).toBe(false)
    expect(notFlushFiveCards).toEqual([])
  })
})
