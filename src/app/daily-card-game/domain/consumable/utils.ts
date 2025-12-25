import { celestialCards } from './celestial-cards'
import { tarotCards } from './tarot-cards'
import {
  CelestialCardDefinition,
  CelestialCardState,
  ConsumableDefinition,
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
  return consumables.find(
    consumable =>
      consumable.consumableType === 'tarotCard' || consumable.consumableType === 'celestialCard'
  )
}
