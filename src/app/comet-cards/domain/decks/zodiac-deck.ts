import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const zodiacDeck: DeckDefinition = {
  id: 'zodiacDeck',
  name: 'Zodiac Deck',
  description: 'Start with Tarot Merchant, Planet Merchant, and Overstock vouchers',
  cards: pokerDeckDefinition,
  modifiers: {
    startingVouchers: ['tarotMerchant', 'planetMerchant', 'overstock'],
  },
}
