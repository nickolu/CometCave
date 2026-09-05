import type {
  CelestialCardDefinition,
  HeldConsumableState,
  TarotCardDefinition,
} from '@/app/comet-cards/domain/consumable/types'
import { getConsumableDefinition } from '@/app/comet-cards/domain/consumable/utils'
import type { GameEvent } from '@/app/comet-cards/domain/events/types'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { getConsumableSellValue } from '@/app/comet-cards/domain/shop/sell-utils'
import type { SpectralCardDefinition } from '@/app/comet-cards/domain/spectral/types'
import { isSpectralCardState, SPECTRAL_SELL_VALUE } from '@/app/comet-cards/domain/spectral/utils'

export type HeldConsumableDefinition =
  | TarotCardDefinition
  | CelestialCardDefinition
  | SpectralCardDefinition

/**
 * The event that spends a held consumable.
 *
 * Returns `undefined` for a card the reducer has no use path for, so the button
 * does nothing rather than firing the wrong card's event — a held Spectral used
 * to fall through to `CELESTIAL_CARD_USED` and quietly do nothing at all.
 */
export function getConsumableUseEvent(consumable: HeldConsumableState): GameEvent | undefined {
  if (isSpectralCardState(consumable)) return { type: 'SPECTRAL_CARD_USED' }
  if (consumable.consumableType === 'tarotCard') return { type: 'TAROT_CARD_USED' }
  if (consumable.consumableType === 'celestialCard') return { type: 'CELESTIAL_CARD_USED' }
  return undefined
}

/** Spectral cards only define `isPlayable` when they need cards selected. */
export function isConsumablePlayable(
  definition: HeldConsumableDefinition | undefined,
  game: GameState
): boolean {
  if (!definition) return false
  return definition.isPlayable?.(game) ?? true
}

/** What the Sell button pays. Spectrals have no price, so they pay a flat rate. */
export function getHeldConsumableSellValue(consumable: HeldConsumableState): number {
  if (isSpectralCardState(consumable)) return SPECTRAL_SELL_VALUE
  const definition = getConsumableDefinition(consumable)
  return definition && 'price' in definition ? getConsumableSellValue(definition) : 0
}

export interface ConsumableDisplay {
  accent: string
  glyph: string
  name: string
  description: string
}

/**
 * How a held consumable reads in the compact bar and the Consumables panel.
 *
 * Falls back to the card's own kind rather than a blank Celestial: a Spectral
 * used to fall into the Celestial branch and render as a nameless "Celestial"
 * that could not be used or sold.
 */
export function describeConsumable(
  consumable: HeldConsumableState,
  definition: HeldConsumableDefinition | undefined
): ConsumableDisplay {
  if (isSpectralCardState(consumable)) {
    return {
      accent: 'var(--cc-rarity-uncommon)',
      glyph: '✦',
      name: definition?.name ?? 'Spectral',
      description: definition?.description ?? 'This card has not yet been implemented.',
    }
  }
  const isTarot = consumable.consumableType === 'tarotCard'
  return {
    accent: isTarot ? 'var(--cc-pink)' : 'var(--cc-gold)',
    glyph: isTarot ? '◈' : '✷',
    name: definition?.name ?? (isTarot ? 'Tarot' : 'Celestial'),
    description: definition?.description ?? '',
  }
}
