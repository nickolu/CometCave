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

  return { gameState, save, load, clear };
}

