import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const ghostDeck: DeckDefinition = {
  id: 'ghostDeck',
  name: 'Ghost Deck',
  description: 'Spectral cards may appear in Arcana Packs. Start with a Hex spectral card',
  cards: pokerDeckDefinition,
  modifiers: {
    startingVouchers: ['omenGlobe'],
  },
}
