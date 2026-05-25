import { GameState } from '@/app/comet-cards/domain/game/types'
import { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import { initializePlayingCard } from '@/app/comet-cards/domain/playing-card/utils'

import { anaglyphDeck } from './anaglyph-deck'
import { abandonedDeck } from './abandoned-deck'
import { blackDeck } from './black-deck'
import { blueDeck } from './blue-deck'
import { checkeredDeck } from './checkered-deck'
import { erraticDeck, generateErraticDeckCards } from './erratic-deck'
import { ghostDeck } from './ghost-deck'
import { greenDeck } from './green-deck'
import { magicDeck } from './magic-deck'
import { nebulaDeck } from './nebula-deck'
import { plasmaDeck } from './plasma-deck'
import { paintedDeck } from './painted-deck'
import { pokerDeck } from './poker-deck'
import { redDeck } from './red-deck'
import { yellowDeck } from './yellow-deck'
import { zodiacDeck } from './zodiac-deck'
import { DeckDefinition } from './types'

export const decks: Record<string, DeckDefinition> = {
  pokerDeck: pokerDeck,
  redDeck: redDeck,
  blueDeck: blueDeck,
  yellowDeck: yellowDeck,
  blackDeck: blackDeck,
  abandonedDeck: abandonedDeck,
  checkeredDeck: checkeredDeck,
  paintedDeck: paintedDeck,
  greenDeck: greenDeck,
  erraticDeck: erraticDeck,
  plasmaDeck: plasmaDeck,
  nebulaDeck: nebulaDeck,
  magicDeck: magicDeck,
  zodiacDeck: zodiacDeck,
  ghostDeck: ghostDeck,
  anaglyphDeck: anaglyphDeck,
}

export const initialDeckStates = (game: GameState): Record<string, PlayingCardState[]> => {
  const result: Record<string, PlayingCardState[]> = {}
  for (const [key, deck] of Object.entries(decks)) {
    const cards = key === 'erraticDeck'
      ? generateErraticDeckCards(game.gameSeed)
      : deck.cards
    result[key] = cards.map(card => initializePlayingCard(card, game))
  }
  return result
}
