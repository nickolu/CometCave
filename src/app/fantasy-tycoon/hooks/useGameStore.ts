"use client";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState } from '../models/types';
import { FantasyCharacter } from '../models/character';
import { defaultGameState } from '../lib/defaultGameState';

export interface GameStore {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  clearGameState: () => void;
  addCharacter: (c: FantasyCharacter) => void;
  deleteCharacter: (id: string) => void;
  selectCharacter: (id: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      gameState: null,
      setGameState: (state: GameState) => set({ gameState: state }),
      clearGameState: () => set({ gameState: null }),
      addCharacter: (c) => {
        set((state) => {
          if (!state.gameState) return {};
          const characters = state.gameState.characters || [];
          if (characters.length >= 5) return {};
          return {
            gameState: {
              ...state.gameState,
              characters: [...characters, c],
            },
          };
        });
      },
      deleteCharacter: (id) => {
        set((state) => {
          if (!state.gameState) return {};
          const characters = (state.gameState.characters || []).filter((char) => char.id !== id);
          // If deleting the selected character, also clear selection
          const selected = state.gameState.character && state.gameState.character.id === id ? null : state.gameState.character;
          return {
            gameState: {
              ...state.gameState,
              characters,
              character: selected,
            },
          };
        });
      },
      selectCharacter: (id) => {
        set((state) => {
          if (!state.gameState) return {};
          const found = (state.gameState.characters || []).find((char) => char.id === id) || null;
          return {
            gameState: {
              ...state.gameState,
              character: found,
            },
          };
        });
      },
    }),
    {
      name: 'fantasy-tycoon-save', // localStorage key
      partialize: (state) => {
        // Only persist character and characters
        if (!state.gameState) return { gameState: null };
        const { character, characters } = state.gameState;
        return { gameState: { character, characters } };
      },
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
