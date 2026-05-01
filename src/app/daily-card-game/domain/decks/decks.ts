import { GameState } from '@/app/daily-card-game/domain/game/types'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { initializePlayingCard } from '@/app/daily-card-game/domain/playing-card/utils'

import { abandonedDeck } from './abandoned-deck'
import { blackDeck } from './black-deck'
import { blueDeck } from './blue-deck'
import { checkeredDeck } from './checkered-deck'
import { pokerDeck } from './poker-deck'
import { redDeck } from './red-deck'
import { yellowDeck } from './yellow-deck'
import { DeckDefinition } from './types'

export const decks: Record<string, DeckDefinition> = {
  pokerDeck: pokerDeck,
  redDeck: redDeck,
  blueDeck: blueDeck,
  yellowDeck: yellowDeck,
  blackDeck: blackDeck,
  abandonedDeck: abandonedDeck,
  checkeredDeck: checkeredDeck,
}

export const initialDeckStates = (game: GameState): Record<string, PlayingCardState[]> => {
  const result: Record<string, PlayingCardState[]> = {}
  for (const [key, deck] of Object.entries(decks)) {
    result[key] = deck.cards.map(card => initializePlayingCard(card, game))
  }
  return result
}
