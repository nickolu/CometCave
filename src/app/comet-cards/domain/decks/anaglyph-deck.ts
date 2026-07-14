import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const anaglyphDeck: DeckDefinition = {
  id: 'anaglyphDeck',
  name: 'Anaglyph Deck',
  description: 'Every Boss Blind gives a Double Tag after defeating it',
  cards: pokerDeckDefinition,
  modifiers: {},
}
