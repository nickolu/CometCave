'use client';
import { create } from 'zustand';
import { produce } from 'immer';
import { persist } from 'zustand/middleware';
import { FantasyDecisionPoint, FantasyStoryEvent, GameState, Item } from '../models/types';
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
  inventory: [],
};

export interface GameStore {
  gameState: GameState;
  addCharacter: (c: Partial<FantasyCharacter>) => void;
  clearGameState: () => void;
  deleteCharacter: (id: string) => void;
  getSelectedCharacter: () => FantasyCharacter | null;
  incrementDistance: () => void;
  selectCharacter: (id: string) => void;
  setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => void;
  setGameState: (gameState: GameState) => void;
  setGenericMessage: (message: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: defaultGameState,
      addCharacter: c => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return;
            const characters = state.gameState.characters || [];
            if (characters.length >= 5) return;
            state.gameState.characters = [...characters, { ...defaultCharacter, ...c }];
          })
        );
      },
      clearGameState: () => set({ gameState: defaultGameState }),
      deleteCharacter: id => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return {};
            const characters = state.gameState.characters || [];
            const selectedCharacterId = state.gameState.selectedCharacterId ?? '';
            const updatedCharacters = characters.filter((char: FantasyCharacter) => char.id !== id);
            const updatedSelectedCharacterId =
              selectedCharacterId === id ? null : selectedCharacterId;

            return {
              gameState: {
                ...state.gameState,
                characters: updatedCharacters,
                selectedCharacterId: updatedSelectedCharacterId,
              },
            };
          })
        );
      },
      getSelectedCharacter: () => {
        const state = get().gameState;
        if (!state) return null;
        return state.characters?.find(c => c.id === state.selectedCharacterId) ?? null;
      },
      incrementDistance: () => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter();
            if (!selectedCharacter) return;
            const updatedCharacter = {
              ...selectedCharacter,
              distance: (selectedCharacter.distance || 0) + 1,
            };
            state.gameState.characters = state.gameState.characters.map(char =>
              char.id === selectedCharacter.id ? updatedCharacter : char
            );
          })
        );
      },
      setGameState: (state: GameState) => set({ gameState: state }),
      selectCharacter: id => {
        set(
          produce((state: GameStore) => {
            const matchingCharacter = state.gameState?.characters?.find(
              (char: FantasyCharacter) => char.id === id
            );
            if (!matchingCharacter) return {};
            const updatedState = {
              gameState: {
                ...state.gameState,
                selectedCharacterId: id,
              },
            };
            return updatedState;
          })
        );
      },
      setGenericMessage: (message: string) => {
        set(
          produce((state: GameStore) => {
            const updatedState = {
              gameState: {
                ...state.gameState,
                genericMessage: message,
              },
            };
            return updatedState;
          })
        );
      },
      setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => {
        set(
          produce((state: GameStore) => {
            const updatedState = {
              gameState: {
                ...state.gameState,
                decisionPoint: decisionPoint,
              },
            };
            return updatedState;
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
  const state = useGameStore(s => s.gameState);
  return state || defaultGameState;
}

export function useGameStateBuilder() {
  const { gameState, setGameState: saveGameState } = useGameStore();

  const gameStateClone = structuredClone(gameState);

  const commit = () => {
    saveGameState(gameStateClone);
  };

  const addItem = (item: Item) => {
    const selectedCharacterId = gameStateClone.selectedCharacterId;
    if (!selectedCharacterId) return;
    const selectedCharacter = gameStateClone.characters?.find(c => c.id === selectedCharacterId);
    if (!selectedCharacter) return;
    selectedCharacter.inventory.push(item);
  };

  const addStoryEvent = (event: FantasyStoryEvent) => {
    gameStateClone.storyEvents.push(event);
  };

  return {
    gameState: gameStateClone,
    commit,
    addItem,
    addStoryEvent,
  };
}
