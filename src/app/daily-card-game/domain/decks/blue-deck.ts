import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const blueDeck: DeckDefinition = {
  id: 'blueDeck',
  name: 'Blue Deck',
  description: '+1 hand every round',
  cards: pokerDeckDefinition,
  modifiers: {
    maxHands: 1,
  },
}
