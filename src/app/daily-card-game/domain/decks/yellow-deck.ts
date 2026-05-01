import { pokerDeckDefinition } from './poker-deck'
import { DeckDefinition } from './types'

export const yellowDeck: DeckDefinition = {
  id: 'yellowDeck',
  name: 'Yellow Deck',
  description: '+$10 starting money',
  cards: pokerDeckDefinition,
  modifiers: {
    money: 10,
  },
}
