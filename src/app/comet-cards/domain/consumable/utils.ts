import { uuid } from '@/app/comet-cards/domain/randomness'

import { celestialCards } from './celestial-cards'
import { tarotCards } from './tarot-cards'
import {
  CelestialCardDefinition,
  CelestialCardState,
  ConsumableEdition,
  ConsumableState,
  TarotCardDefinition,
  TarotCardState,
} from './types'

export function getConsumableDefinition(
  consumable: TarotCardState | CelestialCardState
): TarotCardDefinition | CelestialCardDefinition {
  return consumable.consumableType === 'tarotCard'
    ? tarotCards[consumable.tarotType]
    : celestialCards[consumable.handId]
}

export const findLastTarotOrCelestialCard = (
  consumables: (CelestialCardState | TarotCardState)[]
): TarotCardState | CelestialCardState | undefined => {
  // Find the LAST (most recent) tarot or celestial card, not the first
  return consumables.findLast(
    consumable =>
      consumable.consumableType === 'tarotCard' || consumable.consumableType === 'celestialCard'
  )
}

export const initializeCelestialCard = (
  consumable: CelestialCardDefinition,
  edition?: ConsumableEdition
): CelestialCardState => ({
  id: uuid(),
  consumableType: 'celestialCard',
  handId: consumable.handId,
  ...(edition && { edition }),
})

export const initializeTarotCard = (
  consumable: TarotCardDefinition,
  edition?: ConsumableEdition
): TarotCardState => ({
  id: uuid(),
  consumableType: 'tarotCard',
  tarotType: consumable.tarotType,
  ...(edition && { edition }),
})

/** Count consumables that occupy a slot (excludes Negative edition) */
export function countConsumableSlots(consumables: ConsumableState[]): number {
  return consumables.filter(c => c.edition !== 'negative').length
}

export const isCelestialCardState = (card: unknown): card is CelestialCardState => {
  return (
    typeof card === 'object' &&
    card !== null &&
    'consumableType' in card &&
    card.consumableType === 'celestialCard'
  )
}

export const isTarotCardState = (card: unknown): card is TarotCardState => {
  return (
    typeof card === 'object' &&
    card !== null &&
    'consumableType' in card &&
    card.consumableType === 'tarotCard'
  )
}

export const isTarotCardDefinition = (card: unknown): card is TarotCardDefinition => {
  return typeof card === 'object' && card !== null && 'tarotType' in card
}

export const isCelestialCardDefinition = (card: unknown): card is CelestialCardDefinition => {
  return (
    typeof card === 'object' && card !== null && 'type' in card && card.type === 'celestialCard'
  )
}
