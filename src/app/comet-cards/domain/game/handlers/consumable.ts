import { Draft } from 'immer'

import { celestialCards } from '@/app/comet-cards/domain/consumable/celestial-cards'
import { tarotCards } from '@/app/comet-cards/domain/consumable/tarot-cards'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/comet-cards/domain/consumable/utils'
import { dispatchEffects } from '@/app/comet-cards/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/comet-cards/domain/events/types'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { collectEffects } from '@/app/comet-cards/domain/game/utils'
import { getConsumableSellValue } from '@/app/comet-cards/domain/shop/sell-utils'
import { implementedSpectralCards } from '@/app/comet-cards/domain/spectral/spectal-cards'
import { SPECTRAL_SELL_VALUE, isSpectralCardState } from '@/app/comet-cards/domain/spectral/utils'

export function handleUseConsumableTarotCard(draft: Draft<GameState>, event: GameEvent): void {
  const tarotCard = draft.gamePlayState.selectedConsumable
  if (!tarotCard) return
  if (tarotCard.consumableType !== 'tarotCard') return
  if (tarotCard.tarotType === 'notImplemented') return
  draft.consumablesUsed.push(tarotCard)
  draft.gamePlayState.selectedConsumable = undefined
  draft.consumables = draft.consumables.filter(consumable => consumable.id !== tarotCard.id)

  dispatchEffects(
    event,
    {
      event,
      game: draft as unknown as GameState,
      score: draft.gamePlayState.score,
      playedCards: [],
      round: draft.rounds[draft.roundIndex],
      bossBlind: draft.rounds[draft.roundIndex].bossBlind,
      jokers: draft.jokers,
      vouchers: draft.vouchers,
      tags: draft.tags,
    },
    tarotCards[tarotCard.tarotType].effects
  )
}

export function handleUseConsumableCelestialCard(draft: Draft<GameState>, event: GameEvent): void {
  const celestialCard = draft.gamePlayState.selectedConsumable
  if (!celestialCard) return
  if (celestialCard.consumableType !== 'celestialCard') return
  draft.consumablesUsed.push(celestialCard)
  draft.gamePlayState.selectedConsumable = undefined
  // remove tarot card from consumables
  draft.consumables = draft.consumables.filter(consumable => consumable.id !== celestialCard.id)

  dispatchEffects(
    event,
    {
      event,
      game: draft,
      score: draft.gamePlayState.score,
      playedCards: [],
      round: draft.rounds[draft.roundIndex],
      bossBlind: draft.rounds[draft.roundIndex].bossBlind,
      jokers: draft.jokers,
      vouchers: draft.vouchers,
      tags: draft.tags,
    },
    celestialCards[celestialCard.handId].effects
  )
}

/**
 * Use a Spectral card out of the consumable slots.
 *
 * Spectrals used to be playable only off the top of a pack, which left the ones
 * that arrive already held — Ghost Deck's Hex, and the ones Seance and Sixth
 * Sense create — stuck in a slot with no way to spend or sell them.
 */
export function handleUseConsumableSpectralCard(draft: Draft<GameState>, event: GameEvent): void {
  const spectralCard = draft.gamePlayState.selectedConsumable
  if (!spectralCard || !isSpectralCardState(spectralCard)) return

  const definition = implementedSpectralCards[spectralCard.spectralType]
  if (!definition) return
  if (definition.isPlayable && !definition.isPlayable(draft as unknown as GameState)) return

  draft.consumablesUsed.push(spectralCard)
  draft.gamePlayState.selectedConsumable = undefined
  draft.consumables = draft.consumables.filter(consumable => consumable.id !== spectralCard.id)

  const ctx: EffectContext = {
    event,
    game: draft as unknown as GameState,
    score: draft.gamePlayState.score,
    playedCards: [],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
    tags: draft.tags,
  }

  dispatchEffects(event, ctx, definition.effects)
  // Jokers and vouchers that listen for a Spectral being used hear it too.
  dispatchEffects(event, ctx, collectEffects(ctx.game))

  // Spectrals act on the cards selected in hand; the selection is spent with them.
  draft.gamePlayState.selectedCardIds = []
}

export function handleConsumableSold(draft: Draft<GameState>): void {
  const selectedConsumable = draft.gamePlayState.selectedConsumable
  const sellValue = isCelestialCardState(selectedConsumable)
    ? getConsumableSellValue(celestialCards[selectedConsumable.handId])
    : isTarotCardState(selectedConsumable)
      ? getConsumableSellValue(tarotCards[selectedConsumable.tarotType])
      : isSpectralCardState(selectedConsumable)
        ? SPECTRAL_SELL_VALUE
        : undefined
  if (sellValue === undefined) return
  draft.consumables = draft.consumables.filter(
    consumable => consumable.id !== selectedConsumable?.id
  )
  draft.money += sellValue
  draft.gamePlayState.selectedConsumable = undefined
}
