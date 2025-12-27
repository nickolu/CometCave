import { Draft } from 'immer'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { Effect, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { mulberry32, xmur3 } from '@/app/daily-card-game/domain/randomness'
import { bigBlind, getInProgressBlind, smallBlind } from '@/app/daily-card-game/domain/round/blinds'
import { bossBlinds } from '@/app/daily-card-game/domain/round/boss-blinds'
import type {
  BlindDefinition,
  BlindState,
  RoundState,
} from '@/app/daily-card-game/domain/round/types'

import type { GameState } from './types'

export function getBlindDefinition(type: BlindState['type'], round: RoundState): BlindDefinition {
  if (type === 'smallBlind') return smallBlind
  if (type === 'bigBlind') return bigBlind
  if (type === 'bossBlind') {
    const bossBlind = bossBlinds.find(blind => blind.name === round.bossBlindName)
    if (!bossBlind) throw new Error(`Boss blind not found: ${round.bossBlindName}`)
    return bossBlind
  }

  throw new Error(`Unknown blind type: ${type}`)
}

export function collectEffects(game: GameState): Effect[] {
  const effects: Effect[] = []

  const blind = getInProgressBlind(game)
  if (blind && blind.type === 'bossBlind') {
    effects.push(...getBlindDefinition(blind.type, game.rounds[game.roundIndex]).effects)
  }

  effects.push(...game.jokers.flatMap(j => jokers[j.jokerId]?.effects || []))

  return effects
}

function shuffleDeck(array: PlayingCardState[], rng: () => number): PlayingCardState[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function randomizeDeck({
  deck,
  seed,
  iteration,
}: {
  deck: PlayingCardState[]
  seed: string
  iteration: number
}): PlayingCardState[] {
  const seedFn = xmur3(seed + iteration.toString())
  const rng = mulberry32(seedFn())

  return shuffleDeck(deck, rng)
}

export function useBuyableCelestialCard(draft: Draft<GameState>): void {
  const celestialCardId = draft.shopState.selectedCardId
  if (!celestialCardId) return
  const celestialCard = draft.shopState.cardsForSale.find(card => card.card.id === celestialCardId)
  if (!celestialCard) return
  if (isCelestialCardState(celestialCard.card)) {
    // Important: `dispatchEffects` matches by `event.type`. When buying + using in the shop,
    // the triggering event is typically `SHOP_BUY_AND_USE_CARD`, but the card's effects are
    // keyed off `CELESTIAL_CARD_USED`.
    const usedEvent: GameEvent = { type: 'CELESTIAL_CARD_USED' }
    dispatchEffects(
      usedEvent,
      {
        event: usedEvent,
        game: draft,
        score: draft.gamePlayState.score,
        playedCards: [],
        round: draft.rounds[draft.roundIndex],
        bossBlind: draft.rounds[draft.roundIndex].bossBlind,
        jokers: draft.jokers,
      },
      celestialCards[celestialCard.card.handId].effects
    )
  }
}

export function useConsumableCelestialCard(draft: Draft<GameState>, event: GameEvent): void {
  const celestialCard = draft.gamePlayState.selectedConsumable
  console.log('celestialCard', celestialCard)
  if (!celestialCard) return
  if (celestialCard.consumableType !== 'celestialCard') return
  draft.consumablesUsed.push(celestialCard)
  draft.gamePlayState.selectedConsumable = undefined
  // remove tarot card from consumables
  draft.consumables = draft.consumables.filter(consumable => consumable.id !== celestialCard.id)
  // remove tarot card from pack
  if (draft.shopState.openPackState) {
    draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
      card => card.card.id !== celestialCard.id
    )
  }
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
    },
    celestialCards[celestialCard.handId].effects
  )
}

export function useBuyableTarotCard(draft: Draft<GameState>): void {
  const tarotCardId = draft.shopState.selectedCardId
  if (!tarotCardId) return
  const tarotCard = draft.shopState.cardsForSale.find(card => card.card.id === tarotCardId)
  if (!tarotCard) return
  if (isTarotCardState(tarotCard.card)) {
    draft.consumables.push(tarotCard.card)
    // See note in `useBuyableCelestialCard`: buy+use triggers a shop event, but tarot effects
    // are keyed off `TAROT_CARD_USED`.
    const usedEvent: GameEvent = { type: 'TAROT_CARD_USED' }
    dispatchEffects(
      usedEvent,
      {
        event: usedEvent,
        game: draft,
        score: draft.gamePlayState.score,
        playedCards: [],
        round: draft.rounds[draft.roundIndex],
        bossBlind: draft.rounds[draft.roundIndex].bossBlind,
        jokers: draft.jokers,
      },
      tarotCards[tarotCard.card.tarotType].effects
    )
  }
}

export function useConsumableTarotCard(draft: Draft<GameState>, event: GameEvent): void {
  const tarotCard = draft.gamePlayState.selectedConsumable
  if (!tarotCard) return
  if (tarotCard.consumableType !== 'tarotCard') return
  if (tarotCard.tarotType === 'notImplemented') return
  draft.consumablesUsed.push(tarotCard)
  draft.gamePlayState.selectedConsumable = undefined
  // remove tarot card from consumables
  draft.consumables = draft.consumables.filter(consumable => consumable.id !== tarotCard.id)
  // remove tarot card from pack
  if (draft.shopState.openPackState) {
    draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
      card => card.card.id !== tarotCard.id
    )
  }

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
    },
    tarotCards[tarotCard.tarotType].effects
  )
}
