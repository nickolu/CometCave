"use client";
import { useCallback, useState } from 'react';
import { GameState, saveGame, loadGame, clearGame } from '../lib/storage';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(() => loadGame());

  const save = useCallback((state: GameState) => {
    saveGame(state);
    setGameState(state);
  }, []);

  const load = useCallback(() => {
    const state = loadGame();
    setGameState(state);
    return state;
  }, []);

  const clear = useCallback(() => {
    clearGame();
    setGameState(null);
  }, []);

  return { gameState, save, load, clear };
}
