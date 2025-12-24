import { GameEvent } from '@/app/daily-card-game/domain/events/types'

class EventEmitter {
  private events: Record<GameEvent['type'], Array<(event: GameEvent) => void>> = {
    BIG_BLIND_SELECTED: [],
    BIG_BLIND_SKIPPED: [],
    BLIND_REWARDS_END: [],
    BLIND_REWARDS_START: [],
    BLIND_SELECTION_BACK_TO_MENU: [],
    BOSS_BLIND_SELECTED: [],
    CARD_DESELECTED: [],
    CARD_SCORED: [],
    CARD_SELECTED: [],
    DISCARD_SELECTED_CARDS: [],
    DISPLAY_JOKERS: [],
    GAME_START: [],
    HAND_DEALT: [],
    HAND_SCORING_END: [],
    HAND_SCORING_START: [],
    JOKER_ADDED: [],
    JOKER_REMOVED: [],
    PACK_OPEN_BACK_TO_SHOP: [],
    ROUND_END: [],
    SHOP_OPEN_PACK: [],
    SHOP_SELECT_BLIND: [],
    SMALL_BLIND_SELECTED: [],
    SMALL_BLIND_SKIPPED: [],
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
