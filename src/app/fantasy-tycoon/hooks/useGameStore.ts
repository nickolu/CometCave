"use client";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState } from '../models/types';
import { defaultGameState } from '../lib/defaultGameState';

interface GameStore {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  clearGameState: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      gameState: null,
      setGameState: (state: GameState) => set({ gameState: state }),
      clearGameState: () => set({ gameState: null }),
    }),
    {
      name: 'fantasy-tycoon-save', // localStorage key
      partialize: (state) => ({ gameState: state.gameState }),
      onRehydrateStorage: () => () => {
        // Optionally, add migration or logging here
      },
    }
  )
);

// Helper to get state with fallback to default
export function useEffectiveGameState(): GameState {
  const state = useGameStore((s) => s.gameState);
  return state || defaultGameState;
}
