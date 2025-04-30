"use client";
import { useGameStore } from './useGameStore';
import { GameState } from '../models/types';

export function useGameState() {
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const clearGameState = useGameStore((s) => s.clearGameState);

  const save = (state: GameState) => setGameState(state);
  const load = () => gameState;
  const clear = () => clearGameState();

  const addCharacter = useGameStore((s) => s.addCharacter);
  const deleteCharacter = useGameStore((s) => s.deleteCharacter);
  const selectCharacter = useGameStore((s) => s.selectCharacter);

  return { gameState, save, load, clear, addCharacter, deleteCharacter, selectCharacter };
}

