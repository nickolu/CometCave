import { getDefaultCard } from '@/app/comet-cards/domain/playing-card/playing-cards'
import { CardValue, PlayingCardDefinition } from '@/app/comet-cards/domain/playing-card/types'
import {
  buildSeedString,
  getRandomNumberWithSeed,
} from '@/app/comet-cards/domain/randomness'

import { DeckDefinition } from './types'

const ALL_VALUES: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const ALL_SUITS: PlayingCardDefinition['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']

export function generateErraticDeckCards(gameSeed: string): PlayingCardDefinition[] {
  const cards: PlayingCardDefinition[] = []

  for (let i = 0; i < 52; i++) {
    const seed = buildSeedString([gameSeed, 'erratic', i.toString()])
    const valueIdx = getRandomNumberWithSeed(
      buildSeedString([seed, 'value']),
      0,
      ALL_VALUES.length - 1
    )
    const suitIdx = getRandomNumberWithSeed(
      buildSeedString([seed, 'suit']),
      0,
      ALL_SUITS.length - 1
    )
    cards.push(getDefaultCard(ALL_VALUES[valueIdx], ALL_SUITS[suitIdx]))
  }

  return cards
}

export const erraticDeck: DeckDefinition = {
  id: 'erraticDeck',
  name: 'Erratic Deck',
  description: 'All ranks and suits in deck are randomized',
  cards: [], // Cards are generated dynamically per game seed
  modifiers: {},
}
