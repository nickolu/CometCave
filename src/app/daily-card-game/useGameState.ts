'use client';

import { useDailyCardGameStore } from './store';

export function useGameState() {
  // Avoid returning a new object from a selector; it can trigger
  // "getServerSnapshot should be cached" warnings / re-render loops.
  const game = useDailyCardGameStore(state => state.game);
  const setGamePhase = useDailyCardGameStore(state => state.setGamePhase);
  const dealHand = useDailyCardGameStore(state => state.dealHand);
  const selectCard = useDailyCardGameStore(state => state.selectCard);
  const deselectCard = useDailyCardGameStore(state => state.deselectCard);
  return { game, setGamePhase, dealHand, selectCard, deselectCard };
}
