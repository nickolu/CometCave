import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const greenDeck: DeckDefinition = {
  id: 'greenDeck',
  name: 'Green Deck',
  description:
    'No interest at end of round. Earn $1 for each remaining hand and $1 for each remaining discard at end of round.',
  cards: pokerDeckDefinition,
  modifiers: {
    maxInterest: -5, // Sets maxInterest to 0 (default is 5)
  },
}
