"use client";
import { create } from 'zustand';
import { produce } from 'immer';
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
      gameState: defaultGameState,
      setGameState: (state: GameState) => set({ gameState: state }),
      clearGameState: () => set({ gameState: defaultGameState }),
      addCharacter: (c) => {
        console.log('[useGameStore] addCharacter called', c);
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return;
            const characters = state.gameState.characters || [];
            if (characters.length >= 5) return;
            state.gameState.characters = [...characters, c];
          })
        );
      },
      deleteCharacter: (id) => {
        set(
          produce((state) => {
          if (!state.gameState) return {};
          const characters = (state.gameState.characters || []).filter((char: FantasyCharacter) => char.id !== id);
          // If deleting the selected character, also clear selection
          const selected = state.gameState.character && state.gameState.character.id === id ? null : state.gameState.character;
          return {
            gameState: {
              ...state.gameState,
              characters,
              character: selected,
            },
          };
        }));
      },
      selectCharacter: (id) => {
        set(
          produce((state: GameStore) => {
          console.log('[useGameStore] selectCharacter called', state)
          const matchingCharacter = state.gameState?.characters?.find((char: FantasyCharacter) => char.id === id);
          if (!matchingCharacter) return {};
          const updatedState = {
            gameState: {
              ...state.gameState,
              character: matchingCharacter,
            },
          }
          console.log('[useGameStore] selectCharacter updatedState', JSON.stringify(updatedState))
          return updatedState;
        }));
      },
    }),
    {
      name: 'fantasy-tycoon-storage', // localStorage key
    }
  )
);

// Helper to get state with fallback to default
export function useEffectiveGameState(): GameState {
  const state = useGameStore((s) => s.gameState);
  return state || defaultGameState;
}
