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
import type { CardValue, PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'

const c = (value: CardValue, suit: PlayingCard['suit'], id: string): PlayingCard => ({
  value,
  suit,
  id,
  baseChips: 0,
  isHolographic: false,
  isFoil: false,
  faceUp: true,
})

describe('daily-card-game hand checkers', () => {
  it('checkHandForHighCard returns the first ranked card (by value then suit)', () => {
    const cards = [
      c('A', 'spades', 'aS'),
      c('2', 'spades', '2S'),
      c('2', 'hearts', '2H'),
      c('K', 'clubs', 'kC'),
    ]

    const [isHighCard, highCard] = checkHandForHighCard(cards)
    expect(isHighCard).toBe(true)
    // rankCardsByValueAndSuit sorts ascending by value priority, then suit priority (hearts < diamonds < clubs < spades)
    expect(highCard).toEqual([c('2', 'hearts', '2H')])
  })

  it('checkHandForPair returns the top-ranked pair among all pairs', () => {
    const twoHearts = c('2', 'hearts', '2H')
    const twoSpades = c('2', 'spades', '2S')
    const aceClubs = c('A', 'clubs', 'aC')
    const aceSpades = c('A', 'spades', 'aS')
    const filler = c('9', 'diamonds', '9D')

    const [isPair, pair] = checkHandForPair([aceSpades, twoSpades, filler, twoHearts, aceClubs])
    expect(isPair).toBe(true)
    // current implementation ranks ascending, so the pair of 2s wins over the pair of Aces
    expect(pair).toEqual([twoSpades, twoHearts])
  })

  it('checkHandForPair returns false when no pairs exist', () => {
    const [isPair, pair] = checkHandForPair([
      c('2', 'hearts', '2H'),
      c('3', 'clubs', '3C'),
      c('4', 'spades', '4S'),
      c('5', 'diamonds', '5D'),
    ])
    expect(isPair).toBe(false)
    expect(pair).toEqual([])
  })

  it('checkHandForTwoPair returns the two top-ranked pairs (in rank order)', () => {
    const twoHearts = c('2', 'hearts', '2H')
    const twoSpades = c('2', 'spades', '2S')
    const threeClubs = c('3', 'clubs', '3C')
    const threeDiamonds = c('3', 'diamonds', '3D')
    const aceClubs = c('A', 'clubs', 'aC')
    const aceSpades = c('A', 'spades', 'aS')

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
      c('2', 'hearts', '2H'),
      c('2', 'spades', '2S'),
      c('3', 'clubs', '3C'),
      c('4', 'spades', '4S'),
    ])
    expect(isTwoPair).toBe(false)
    expect(twoPair).toEqual([])
  })

  it('checkHandForThreeOfAKind returns the top-ranked trips among all trips', () => {
    const trips4 = [c('4', 'hearts', '4H'), c('4', 'clubs', '4C'), c('4', 'spades', '4S')]
    const trips7 = [c('7', 'hearts', '7H'), c('7', 'clubs', '7C'), c('7', 'spades', '7S')]

    const [isTrips, trips] = checkHandForThreeOfAKind([...trips7, ...trips4])
    expect(isTrips).toBe(true)
    // current implementation ranks ascending, so 4s win over 7s
    expect(trips).toEqual(trips4)
  })

  it('checkHandForStraight requires cards to be in sequential value order', () => {
    const straight = [
      c('2', 'hearts', '2H'),
      c('3', 'clubs', '3C'),
      c('4', 'spades', '4S'),
      c('5', 'diamonds', '5D'),
      c('6', 'hearts', '6H'),
    ]

    const [isStraight, straightCards] = checkHandForStraight(straight, 5)
    expect(isStraight).toBe(true)
    expect(straightCards).toEqual(straight)

    const [isNotStraight, notStraightCards] = checkHandForStraight(
      [
        c('2', 'hearts', '2H2'),
        c('3', 'clubs', '3C2'),
        c('5', 'spades', '5S2'),
        c('6', 'diamonds', '6D2'),
        c('7', 'hearts', '7H2'),
      ],
      5
    )
    expect(isNotStraight).toBe(false)
    expect(notStraightCards).toEqual([])
  })

  it('checkHandForFlush checks the suit of the first ranked card and returns the first N of that suit', () => {
    const twoHearts = c('2', 'hearts', '2H')
    const fiveHearts = c('5', 'hearts', '5H')
    const eightHearts = c('8', 'hearts', '8H')
    const threeSpades = c('3', 'spades', '3S')
    const kingClubs = c('K', 'clubs', 'kC')

    const [isFlush, flushCards] = checkHandForFlush(
      [kingClubs, eightHearts, threeSpades, fiveHearts, twoHearts],
      3
    )
    expect(isFlush).toBe(true)
    expect(flushCards).toEqual([twoHearts, fiveHearts, eightHearts])

    const [isNotFlush, notFlushCards] = checkHandForFlush([twoHearts, threeSpades, kingClubs], 2)
    expect(isNotFlush).toBe(false)
    expect(notFlushCards).toEqual([])
  })

  it('checkHandForFullHouse returns trips + one pair (using reference equality to exclude the trips)', () => {
    const trips = [c('4', 'hearts', '4H'), c('4', 'clubs', '4C'), c('4', 'spades', '4S')]
    const pair = [c('9', 'diamonds', '9D'), c('9', 'hearts', '9H')]

    const [isFullHouse, fullHouseCards] = checkHandForFullHouse([...trips, ...pair])
    expect(isFullHouse).toBe(true)
    expect(fullHouseCards).toEqual([...trips, ...pair])

    const [isNotFullHouse, notFullHouseCards] = checkHandForFullHouse([
      c('4', 'hearts', '4H2'),
      c('4', 'clubs', '4C2'),
      c('4', 'spades', '4S2'),
      c('9', 'diamonds', '9D2'),
      c('A', 'hearts', 'aH2'),
    ])
    expect(isNotFullHouse).toBe(false)
    expect(notFullHouseCards).toEqual([])
  })

  it('checkHandForFourOfAKind returns the four-of-a-kind when present', () => {
    const quads = [
      c('K', 'hearts', 'kH'),
      c('K', 'diamonds', 'kD'),
      c('K', 'clubs', 'kC'),
      c('K', 'spades', 'kS'),
    ]
    const kicker = c('2', 'hearts', '2Hk')

    const [isQuads, quadCards] = checkHandForFourOfAKind([kicker, ...quads])
    expect(isQuads).toBe(true)
    expect(quadCards).toEqual(quads)

    const [isNotQuads, notQuadCards] = checkHandForFourOfAKind([
      c('K', 'hearts', 'kH2'),
      c('K', 'diamonds', 'kD2'),
      c('K', 'clubs', 'kC2'),
      c('2', 'spades', '2S2'),
    ])
    expect(isNotQuads).toBe(false)
    expect(notQuadCards).toEqual([])
  })

  it('checkHandForStraightFlush currently only checks for a straight (not suit)', () => {
    const mixedSuitStraight = [
      c('2', 'hearts', '2H'),
      c('3', 'clubs', '3C'),
      c('4', 'spades', '4S'),
      c('5', 'diamonds', '5D'),
      c('6', 'hearts', '6H'),
    ]
    const [isStraightFlush, straightFlushCards] = checkHandForStraightFlush(mixedSuitStraight, 5)
    expect(isStraightFlush).toBe(true)
    expect(straightFlushCards).toEqual(mixedSuitStraight)
  })

  it('checkHandForFlushHouse requires a straight where all cards are the same suit', () => {
    const suitedStraight = [
      c('2', 'hearts', '2H'),
      c('3', 'hearts', '3H'),
      c('4', 'hearts', '4H'),
      c('5', 'hearts', '5H'),
      c('6', 'hearts', '6H'),
    ]
    const [isFlushHouse, flushHouseCards] = checkHandForFlushHouse(suitedStraight, 5)
    expect(isFlushHouse).toBe(true)
    expect(flushHouseCards).toEqual(suitedStraight)

    const mixedSuitStraight = [
      c('2', 'hearts', '2H2'),
      c('3', 'clubs', '3C2'),
      c('4', 'spades', '4S2'),
      c('5', 'diamonds', '5D2'),
      c('6', 'hearts', '6H2'),
    ]
    const [isNotFlushHouse, notFlushHouseCards] = checkHandForFlushHouse(mixedSuitStraight, 5)
    expect(isNotFlushHouse).toBe(false)
    expect(notFlushHouseCards).toEqual([])
  })

  it('checkHandForFiveOfAKind requires exactly five cards with the same value', () => {
    const fiveAces = [
      c('A', 'hearts', 'aH'),
      c('A', 'diamonds', 'aD'),
      c('A', 'clubs', 'aC'),
      c('A', 'spades', 'aS'),
      c('A', 'hearts', 'aH2'),
    ]
    const [isFive, fiveCards] = checkHandForFiveOfAKind(fiveAces, 5)
    expect(isFive).toBe(true)
    expect(fiveCards).toEqual(fiveAces)

    const [isNotFive, notFiveCards] = checkHandForFiveOfAKind(
      [
        c('A', 'hearts', 'aH3'),
        c('A', 'diamonds', 'aD3'),
        c('A', 'clubs', 'aC3'),
        c('A', 'spades', 'aS3'),
        c('K', 'hearts', 'kH3'),
      ],
      5
    )
    expect(isNotFive).toBe(false)
    expect(notFiveCards).toEqual([])

    const [isNotExactlyFive, notExactlyFiveCards] = checkHandForFiveOfAKind(
      [
        c('A', 'hearts', 'aH4'),
        c('A', 'diamonds', 'aD4'),
        c('A', 'clubs', 'aC4'),
        c('A', 'spades', 'aS4'),
      ],
      5
    )
    expect(isNotExactlyFive).toBe(false)
    expect(notExactlyFiveCards).toEqual([])
  })

  it('checkHandForFlushFive requires exactly five cards with the same value and same suit', () => {
    const flushFive = [
      c('7', 'hearts', '7H1'),
      c('7', 'hearts', '7H2'),
      c('7', 'hearts', '7H3'),
      c('7', 'hearts', '7H4'),
      c('7', 'hearts', '7H5'),
    ]
    const [isFlushFive, flushFiveCards] = checkHandForFlushFive(flushFive)
    expect(isFlushFive).toBe(true)
    expect(flushFiveCards).toEqual(flushFive)

    const [isNotFlushFive, notFlushFiveCards] = checkHandForFlushFive([
      c('7', 'hearts', '7H6'),
      c('7', 'diamonds', '7D6'),
      c('7', 'clubs', '7C6'),
      c('7', 'spades', '7S6'),
      c('7', 'hearts', '7H7'),
    ])
    expect(isNotFlushFive).toBe(false)
    expect(notFlushFiveCards).toEqual([])
  })
})
