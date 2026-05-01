import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const blackDeck: DeckDefinition = {
  id: 'blackDeck',
  name: 'Black Deck',
  description: '+1 Joker slot, -1 hand per round',
  cards: pokerDeckDefinition,
  modifiers: {
    maxJokers: 1,
    maxHands: -1,
  },
}
