import { produce } from 'immer'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { implementedTarotCards as tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { GameEvent } from '@/app/daily-card-game/domain/events/types'
import { dealCardsFromDrawPile } from '@/app/daily-card-game/domain/game/card-registry-utils'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'

import { HAND_SIZE } from './constants'
import { handleHandScoringEnd } from './handlers'
import {
  handleBigBlindSelected,
  handleBlindSkipped,
  handleBossBlindSelected,
  handleSmallBlindSelected,
} from './handlers/blind-selection'
import {
  handleConsumableSold,
  handleUseConsumableCelestialCard,
  handleUseConsumableTarotCard,
} from './handlers/consumable'
import {
  handleCardDeselected,
  handleCardScored,
  handleCardSelected,
  handleDiscardSelectedCards,
  handleHandScoringDoneCardScoring,
  handleHandScoringStart,
} from './handlers/gameplay'
import { handleGameStart } from './handlers/navigation'
import {
  handleShopBuyAndUseCard,
  handleShopBuyCard,
  handleShopBuyVoucher,
  handleShopOpen,
  handleShopOpenPack,
  handleShopReroll,
  handleShopSelectBlind,
  handleShopSelectJokerFromPack,
  handleShopSelectPlayingCardFromPack,
  handleShopUseCelestialCardFromPack,
  handleShopUseSpectralCardFromPack,
  handleShopUseTarotCardFromPack,
} from './handlers/shop'
import { collectEffects, getEffectContext, removeJoker } from './utils'

import type { GameState } from './types'

export function reduceGame(game: GameState, event: GameEvent): GameState {
  return produce(game, draft => {
    switch (event.type) {
      /*
       * NAVIGATION EVENTS
       */

      case 'GAME_START': {
        handleGameStart(draft, event)
        return
      }
      case 'BACK_TO_MAIN_MENU': {
        draft.gamePhase = 'mainMenu'
        return
      }
      case 'DISPLAY_JOKERS': {
        draft.gamePhase = 'jokers'
        return
      }
      case 'DISPLAY_VOUCHERS': {
        draft.gamePhase = 'vouchers'
        return
      }
      case 'DISPLAY_TAROT_CARDS': {
        draft.gamePhase = 'tarotCards'
        return
      }
      case 'DISPLAY_CELESTIALS': {
        draft.gamePhase = 'celestialCards'
        return
      }
      case 'DISPLAY_SPECTRAL_CARDS': {
        draft.gamePhase = 'spectralCards'
        return
      }
      case 'DISPLAY_TAGS': {
        draft.gamePhase = 'tags'
        return
      }
      case 'DISPLAY_BOSS_BLINDS': {
        draft.gamePhase = 'bossBlinds'
        return
      }

      /*
       * BLIND SELECTION EVENTS
       */

      case 'SMALL_BLIND_SELECTED': {
        handleSmallBlindSelected(draft)
        return
      }
      case 'BIG_BLIND_SELECTED': {
        handleBigBlindSelected(draft)
        return
      }
      case 'BOSS_BLIND_SELECTED': {
        handleBossBlindSelected(draft)
        return
      }
      case 'BLIND_SKIPPED': {
        handleBlindSkipped(draft, event)
        return
      }

      /*
       * GAMEPLAY EVENTS
       */

      case 'HAND_DEALT': {
        if (draft.gamePlayState.handIds.length) return
        dealCardsFromDrawPile(draft, HAND_SIZE)
        return
      }
      case 'CARD_SELECTED': {
        handleCardSelected(draft, event)
        return
      }
      case 'CARD_DESELECTED': {
        handleCardDeselected(draft, event)
        return
      }
      case 'DISCARD_SELECTED_CARDS': {
        handleDiscardSelectedCards(draft)
        return
      }

      case 'CARD_SCORED': {
        handleCardScored(draft, event)
        return
      }
      case 'HAND_SCORING_START': {
        handleHandScoringStart(draft, event)
        return
      }
      case 'HAND_SCORING_DONE_CARD_SCORING': {
        const ctx = getEffectContext(draft, event, {
          playedCards: draft.gamePlayState.selectedHand?.[1],
        })
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'HAND_SCORING_FINALIZE': {
        handleHandScoringEnd(draft, event)
        return
      }
      case 'BLIND_REWARDS_START': {
        // no op
        return
      }
      case 'BLIND_REWARDS_END': {
        handleHandScoringDoneCardScoring(draft)
        return
      }

      /*
       * SHOP EVENTS
       */

      case 'SHOP_OPEN': {
        handleShopOpen(draft, event)
        return
      }

      case 'SHOP_SELECT_BLIND': {
        handleShopSelectBlind(draft)
        return
      }
      case 'SHOP_SELECT_PLAYING_CARD_FROM_PACK': {
        handleShopSelectPlayingCardFromPack(draft, event)
        return
      }
      case 'SHOP_SELECT_JOKER_FROM_PACK': {
        handleShopSelectJokerFromPack(draft, event)
        return
      }
      case 'SHOP_USE_TAROT_CARD_FROM_PACK': {
        handleShopUseTarotCardFromPack(draft, event)
        return
      }
      case 'SHOP_USE_CELESTIAL_CARD_FROM_PACK': {
        handleShopUseCelestialCardFromPack(draft, event)
        return
      }
      case 'SHOP_USE_SPECTRAL_CARD_FROM_PACK': {
        handleShopUseSpectralCardFromPack(draft, event)
        return
      }
      case 'SHOP_BUY_CARD': {
        handleShopBuyCard(draft, event)
        return
      }
      case 'SHOP_BUY_AND_USE_CARD': {
        handleShopBuyAndUseCard(draft)
        return
      }
      case 'SHOP_SELECT_CARD': {
        const id = event.id
        if (draft.shopState.selectedCardId === id) return
        draft.shopState.selectedCardId = id
        return
      }
      case 'SHOP_DESELECT_CARD': {
        const id = event.id
        if (draft.shopState.selectedCardId !== id) return
        draft.shopState.selectedCardId = null
        return
      }
      case 'SHOP_REROLL': {
        handleShopReroll(draft)
        return
      }
      case 'SHOP_OPEN_PACK': {
        handleShopOpenPack(draft, event)
        return
      }
      case 'SHOP_BUY_VOUCHER': {
        handleShopBuyVoucher(draft, event)
        return
      }
      case 'PACK_OPEN_SKIP': {
        if (!draft.shopState.openPackState) return
        draft.gamePhase = 'shop'
        draft.shopState.openPackState = null
        return
      }

      /*
       * CONSUMABLE EVENTS
       */

      case 'CONSUMABLE_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id === id) return
        gamePlayState.selectedConsumable = draft.consumables.find(
          consumable => consumable.id === id
        )
        return
      }
      case 'CONSUMABLE_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id !== id) return
        gamePlayState.selectedConsumable = undefined
        return
      }
      case 'CELESTIAL_CARD_USED': {
        handleUseConsumableCelestialCard(draft, event)
        return
      }
      case 'TAROT_CARD_USED': {
        handleUseConsumableTarotCard(draft, event)
        return
      }
      case 'SPECTRAL_CARD_USED': {
        // Spectral cards are currently only usable from packs via SHOP_USE_SPECTRAL_CARD_FROM_PACK
        // This case handles the event for effect dispatching purposes
        return
      }
      case 'CONSUMABLE_SOLD': {
        handleConsumableSold(draft)
        return
      }

      /*
       * JOKER EVENTS
       */
      case 'JOKER_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedJokerId === id) return
        gamePlayState.selectedJokerId = id
        return
      }
      case 'JOKER_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedJokerId !== id) return
        gamePlayState.selectedJokerId = undefined
        return
      }
      case 'JOKER_SOLD': {
        const selectedJoker = draft.jokers.find(
          joker => joker.id === draft.gamePlayState.selectedJokerId
        )
        if (!selectedJoker) return
        draft.money += jokers[selectedJoker.jokerId].price
        removeJoker(draft, event, selectedJoker)
        return
      }
      case 'JOKER_ADDED': {
        return
      }
      case 'JOKER_REMOVED': {
        const selectedJoker = draft.jokers.find(
          joker => joker.id === draft.gamePlayState.selectedJokerId
        )
        if (!selectedJoker) return
        removeJoker(draft, event, selectedJoker)
        return
      }

      /*
       * NO-OP EVENTS
       */

      case 'ROUND_END': {
        return
      }

      default: {
        // Exhaustiveness guard in case GameEvent grows
        const _exhaustive: never = event
        return _exhaustive
      }
    }
  })
}
