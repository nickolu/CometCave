import { GameEvent } from '@/app/daily-card-game/domain/events/types'

class EventEmitter {
  private events: Record<GameEvent['type'], Array<(event: GameEvent) => void>> = {
    HAND_SCORING_START: [],
    CARD_SCORED: [],
    HAND_SCORING_END: [],
    HAND_DEALT: [],
    GAME_START: [],
    ROUND_END: [],
    CARD_SELECTED: [],
    CARD_DESELECTED: [],
    DISCARD_SELECTED_CARDS: [],
    SMALL_BLIND_SELECTED: [],
    SMALL_BLIND_SKIPPED: [],
    BIG_BLIND_SELECTED: [],
    BIG_BLIND_SKIPPED: [],
    BOSS_BLIND_SELECTED: [],
    BLIND_REWARDS_START: [],
    BLIND_REWARDS_END: [],
    SHOP_SELECT_BLIND: [],
    SHOP_OPEN_PACK: [],
    PACK_OPEN_BACK_TO_SHOP: [],
    BLIND_SELECTION_BACK_TO_MENU: [],
    DISPLAY_JOKERS: [],
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
