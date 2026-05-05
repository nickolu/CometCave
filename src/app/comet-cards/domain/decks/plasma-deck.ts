import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const plasmaDeck: DeckDefinition = {
  id: 'plasmaDeck',
  name: 'Plasma Deck',
  description: 'Balance Chips and Mult when calculating score (average them). Blind sizes ×2',
  cards: pokerDeckDefinition,
  modifiers: {},
}
