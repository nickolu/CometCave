"use client";
import { create } from 'zustand';
import { produce } from 'immer';
import { persist } from 'zustand/middleware';
import { GameState } from '../models/types';
import { FantasyCharacter } from '../models/character';
import { defaultGameState } from '../lib/defaultGameState';


const defaultCharacter: FantasyCharacter = {
  id: '',
  playerId: '',
  name: '',
  race: '',
  class: '',
  level: 1,
  abilities: [],
  locationId: '',
  gold: 0,
  reputation: 0,
  distance: 0,
  status: 'active',
  strength: 0,
  intelligence: 0,
  luck: 0,
};
export interface GameStore {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  clearGameState: () => void;
  addCharacter: (c: Partial<FantasyCharacter>) => void;
  deleteCharacter: (id: string) => void;
  selectCharacter: (id: string) => void;
  setGenericMessage: (message: string) => void;
  incrementDistance: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      gameState: defaultGameState,
      setGameState: (state: GameState) => set({ gameState: state }),
      clearGameState: () => set({ gameState: defaultGameState }),
      addCharacter: (c) => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return;
            const characters = state.gameState.characters || [];
            if (characters.length >= 5) return;
            state.gameState.characters = [...characters, {...defaultCharacter, ...c}];
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
          const matchingCharacter = state.gameState?.characters?.find((char: FantasyCharacter) => char.id === id);
          if (!matchingCharacter) return {};
          const updatedState = {
            gameState: {
              ...state.gameState,
              character: matchingCharacter,
            },
          }
          return updatedState;
        }));
      },
      setGenericMessage: (message: string) => {
        set(
          produce((state: GameStore) => {
          const updatedState = {
            gameState: {
              ...state.gameState,
              genericMessage: message,
            },
          }
          return updatedState;
        }));
      },
      incrementDistance: () => {
        set(
          produce((state: GameStore) => {
          const updatedState = {
            gameState: {
              ...state.gameState,
              character: {
                ...state.gameState?.character,
                distance: (state.gameState?.character?.distance || 0) + 1,
              },
            },
          }
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
