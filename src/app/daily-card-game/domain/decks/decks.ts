import { GameState } from '@/app/daily-card-game/domain/game/types'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'

import { initialPokerDeckState, pokerDeckDefinition } from './poker-deck'

export const decks = {
  pokerDeck: pokerDeckDefinition,
}

export const initialDeckStates = (game: GameState): Record<string, PlayingCardState[]> => ({
  pokerDeck: initialPokerDeckState(game),
})
