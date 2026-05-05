import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const nebulaDeck: DeckDefinition = {
  id: 'nebulaDeck',
  name: 'Nebula Deck',
  description: 'Start with the Telescope voucher, -1 consumable slot',
  cards: pokerDeckDefinition,
  modifiers: {
    maxConsumables: -1,
    startingVouchers: ['telescope'],
  },
}
