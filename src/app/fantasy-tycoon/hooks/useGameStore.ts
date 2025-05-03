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
          const characters = state.gameState.characters || [];
          const selectedCharacterId = state.gameState.selectedCharacterId ?? '';
          const updatedCharacters = characters.filter((char: FantasyCharacter) => char.id !== id);
          const updatedSelectedCharacterId = selectedCharacterId === id ? null : selectedCharacterId;
          
          return {
            gameState: {
              ...state.gameState,
              characters: updatedCharacters,
              selectedCharacterId: updatedSelectedCharacterId,
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
              selectedCharacterId: id,
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
            console.log('incrementing distance');
            const selectedCharacterId = state.gameState?.selectedCharacterId;
            if (!state.gameState?.characters) return;
            for (const char of state.gameState.characters) {
              if (char.id === selectedCharacterId) {
                char.distance = (char.distance || 0) + 1;
                break;
              }
            }
          })
        );
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
