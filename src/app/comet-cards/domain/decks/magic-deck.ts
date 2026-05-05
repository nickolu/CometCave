import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const magicDeck: DeckDefinition = {
  id: 'magicDeck',
  name: 'Magic Deck',
  description: 'Start with the Crystal Ball voucher and 2 Tarot cards',
  cards: pokerDeckDefinition,
  modifiers: {
    startingVouchers: ['crystalBall'],
    startingTarotCards: 2,
  },
}
