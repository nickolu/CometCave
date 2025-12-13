'use client';

import { create } from 'zustand';
import type { GamePhase, GameState } from './types';
import { defaultGameState } from './defaultGameState';

export interface DailyCardGameStore {
  game: GameState;
  setGame: (game: GameState) => void;
  clearGame: () => void;
  setGamePhase: (gamePhase: GamePhase) => void;
}

export const useDailyCardGameStore = create<DailyCardGameStore>()(set => ({
  game: defaultGameState,
  setGame: game => set({ game }),
  clearGame: () => set({ game: defaultGameState }),
  setGamePhase: (gamePhase: GamePhase) => set(state => ({ game: { ...state.game, gamePhase } })),
}));
