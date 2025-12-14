'use client';

import { useDailyCardGameStore } from './store';

export function useGameState() {
  const game = useDailyCardGameStore(state => state.game);
  const setGamePhase = useDailyCardGameStore(state => state.setGamePhase);
  const dealHand = useDailyCardGameStore(state => state.dealHand);
  const selectCard = useDailyCardGameStore(state => state.selectCard);
  const deselectCard = useDailyCardGameStore(state => state.deselectCard);
  const discardSelectedCards = useDailyCardGameStore(state => state.discardSelectedCards);
  const dealCards = useDailyCardGameStore(state => state.dealCards);
  const refillHand = useDailyCardGameStore(state => state.refillHand);

  return {
    game,
    setGamePhase,
    dealHand,
    selectCard,
    deselectCard,
    discardSelectedCards,
    dealCards,
    refillHand,
  };
}
