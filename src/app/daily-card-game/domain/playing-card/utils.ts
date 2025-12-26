import { uuid } from '@/app/daily-card-game/domain/randomness'

import { PlayingCardDefinition, PlayingCardState } from './types'

export function isPlayingCardState(card: unknown): card is PlayingCardState {
  return typeof card === 'object' && card !== null && 'playingCardId' in card
}

export function isPlayingCardDefinition(card: unknown): card is PlayingCardDefinition {
  return typeof card === 'object' && card !== null && 'id' in card
}

export function initializePlayingCard(card: PlayingCardDefinition): PlayingCardState {
  return {
    id: uuid(),
    playingCardId: card.id,
    bonusChips: 0,
    flags: {
      isHolographic: false,
      isFoil: false,
    },
    isFaceUp: true,
  }
}
