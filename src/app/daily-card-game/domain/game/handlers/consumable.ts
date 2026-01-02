import { Draft } from 'immer'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { GameEvent } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

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

export function handleConsumableSold(draft: Draft<GameState>): void {
  const selectedConsumable = draft.gamePlayState.selectedConsumable
  const selectedConsumableDefinition = isCelestialCardState(selectedConsumable)
    ? celestialCards[selectedConsumable.handId]
    : isTarotCardState(selectedConsumable)
      ? tarotCards[selectedConsumable.tarotType]
      : undefined
  if (!selectedConsumableDefinition) return
  draft.consumables = draft.consumables.filter(
    consumable => consumable.id !== selectedConsumable?.id
  )
  draft.money += selectedConsumableDefinition.price
  draft.gamePlayState.selectedConsumable = undefined
}
