"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GameState, loadGame, saveGame } from '../lib/storage';
import { defaultGameState } from '../lib/defaultGameState';

export function useGameQuery() {
  return useQuery<GameState>({
    queryKey: ['fantasy-tycoon', 'game-state'],
    queryFn: async () => {
      // Only attempt to load from localStorage on the client side
      if (typeof window !== 'undefined') {
        const savedGame = loadGame();
        if (savedGame) return savedGame;
      }
      return defaultGameState;
    },
    initialData: defaultGameState,
    staleTime: 1000 * 60,
  });
}

export interface MoveForwardResponse {
  character: import('../models/character').FantasyCharacter;
  event?: import('../models/story').FantasyStoryEvent | null;
  decisionPoint?: import('../models/story').FantasyDecisionPoint | null;
  genericMessage?: string | null;
}

export function useMoveForwardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const currentState = queryClient.getQueryData<GameState>(['fantasy-tycoon', 'game-state']) || defaultGameState;
      if (!currentState.character) throw new Error('No character found');
      const res = await fetch('/api/v1/fantasy-tycoon/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: currentState.character })
      });
      if (!res.ok) throw new Error('Failed to move forward');
      const data: MoveForwardResponse = await res.json();
      const updatedState: GameState = {
        ...currentState,
        character: data.character,
        storyEvents: [
          ...currentState.storyEvents,
          ...(data.event ? [data.event] : [])
        ],
        decisionPoint: data.decisionPoint ?? null,
        genericMessage: data.genericMessage ?? null,
      };
      saveGame(updatedState);
      return updatedState;
    },
    onSuccess: (updatedState) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    }
  });
}

