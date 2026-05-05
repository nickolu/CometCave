import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const redDeck: DeckDefinition = {
  id: 'redDeck',
  name: 'Red Deck',
  description: '+1 discard every round',
  cards: pokerDeckDefinition,
  modifiers: {
    maxDiscards: 1,
  },
}
