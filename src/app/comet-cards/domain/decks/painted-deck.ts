import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const paintedDeck: DeckDefinition = {
  id: 'paintedDeck',
  name: 'Painted Deck',
  description: '+2 hand size, -1 Joker slot',
  cards: pokerDeckDefinition,
  modifiers: {
    handSizeModifier: 2,
    maxJokers: -1,
  },
}
