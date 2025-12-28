import { GameEvent } from '@/app/daily-card-game/domain/events/types'

class EventEmitter {
  private events: Record<GameEvent['type'], Array<(event: GameEvent) => void>> = {
    BIG_BLIND_SELECTED: [],
    BIG_BLIND_SKIPPED: [],
    BLIND_REWARDS_END: [],
    BLIND_REWARDS_START: [],
    BACK_TO_MAIN_MENU: [],
    BOSS_BLIND_SELECTED: [],
    CONSUMABLE_DESELECTED: [],
    CONSUMABLE_SELECTED: [],
    CONSUMABLE_SOLD: [],
    CARD_SCORED: [],
    CARD_SELECTED: [],
    CARD_DESELECTED: [],
    CELESTIAL_CARD_USED: [],
    DISCARD_SELECTED_CARDS: [],
    DISPLAY_JOKERS: [],
    GAME_START: [],
    HAND_DEALT: [],
    HAND_SCORING_DONE_CARD_SCORING: [],
    HAND_SCORING_FINALIZE: [],
    HAND_SCORING_START: [],
    JOKER_ADDED: [],
    JOKER_REMOVED: [],
    JOKER_SELECTED: [],
    JOKER_DESELECTED: [],
    JOKER_SOLD: [],
    ROUND_END: [],
    SHOP_OPEN: [],
    SHOP_SELECT_CARD: [],
    SHOP_DESELECT_CARD: [],
    SHOP_SELECT_BLIND: [],
    SHOP_REROLL: [],
    SHOP_OPEN_PACK: [],
    SMALL_BLIND_SELECTED: [],
    SMALL_BLIND_SKIPPED: [],
    TAROT_CARD_USED: [],
    SHOP_BUY_CARD: [],
    SHOP_SELECT_PLAYING_CARD_FROM_PACK: [],
    SHOP_USE_TAROT_CARD_FROM_PACK: [],
    PACK_OPEN_SKIP: [],
    SHOP_BUY_AND_USE_CARD: [],
    SHOP_BUY_VOUCHER: [],
    DISPLAY_BOSS_BLINDS: [],
    DISPLAY_CELESTIALS: [],
    DISPLAY_TAROT_CARDS: [],
    DISPLAY_VOUCHERS: [],
  }

  private anyListeners: Array<(event: GameEvent) => void> = []

  on<TType extends GameEvent['type']>(
    eventType: TType,
    callback: (event: Extract<GameEvent, { type: TType }>) => void
  ) {
    const wrapped = (event: GameEvent) => callback(event as Extract<GameEvent, { type: TType }>)
    this.events[eventType].push(wrapped)
    return () => {
      const list = this.events[eventType]
      const idx = list.indexOf(wrapped)
      if (idx >= 0) list.splice(idx, 1)
    }
  }

  onAny(callback: (event: GameEvent) => void) {
    this.anyListeners.push(callback)
    return () => {
      const idx = this.anyListeners.indexOf(callback)
      if (idx >= 0) this.anyListeners.splice(idx, 1)
    }
  }

  emit(event: GameEvent) {
    this.anyListeners.forEach(callback => callback(event))
    const callbacks = this.events[event.type] || []
    callbacks.forEach(callback => callback(event))
  }
}

export const eventEmitter = new EventEmitter()
