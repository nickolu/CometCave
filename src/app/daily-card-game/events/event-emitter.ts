import { GameEvent } from '../domain/types';

class EventEmitter {
  private events: Record<GameEvent['type'], Array<(event: GameEvent) => void>> = {
    HAND_SCORING_START: [],
    CARD_SCORED: [],
    HAND_SCORING_END: [],
    HAND_DEALT: [],
    ROUND_START: [],
    ROUND_END: [],
    CARD_SELECTED: [],
    CARD_DESELECTED: [],
    DISCARD_SELECTED_CARDS: [],
  };

  on<TType extends GameEvent['type']>(
    eventType: TType,
    callback: (event: Extract<GameEvent, { type: TType }>) => void
  ) {
    const wrapped = (event: GameEvent) => callback(event as Extract<GameEvent, { type: TType }>);
    this.events[eventType].push(wrapped);
    return () => {
      const list = this.events[eventType];
      const idx = list.indexOf(wrapped);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  emit(event: GameEvent) {
    const callbacks = this.events[event.type] || [];
    callbacks.forEach(callback => callback(event));
  }
}

export const eventEmitter = new EventEmitter();
