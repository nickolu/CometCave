'use client';

import { create } from 'zustand';
import type { GamePhase, GameState } from './domain/types';
import { defaultGameState } from './constants/default-game-state';

export interface DailyCardGameStore {
  game: GameState;
  setGame: (game: GameState) => void;
  clearGame: () => void;
  setGamePhase: (gamePhase: GamePhase) => void;
  dealHand: () => void;
  selectCard: (id: string) => void;
  deselectCard: (id: string) => void;
}

export const useDailyCardGameStore = create<DailyCardGameStore>()(set => ({
  game: defaultGameState,
  setGame: game => set({ game }),
  clearGame: () => set({ game: defaultGameState }),
  setGamePhase: (gamePhase: GamePhase) => set(state => ({ game: { ...state.game, gamePhase } })),
  dealHand: () =>
    set(state => ({
      game: {
        ...state.game,
        gamePlayState: { ...state.game.gamePlayState, dealtCards: state.game.fullDeck.slice(0, 7) },
      },
    })),
  selectCard: (id: string) =>
    set(state => ({
      game: {
        ...state.game,
        gamePlayState: {
          ...state.game.gamePlayState,
          selectedCardIds: [...state.game.gamePlayState.selectedCardIds, id],
        },
      },
    })),
  deselectCard: (id: string) =>
    set(state => ({
      game: {
        ...state.game,
        gamePlayState: {
          ...state.game.gamePlayState,
          selectedCardIds: state.game.gamePlayState.selectedCardIds.filter(cardId => cardId !== id),
        },
      },
    })),
}));
