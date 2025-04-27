"use client";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FantasyCharacter } from '../models/character';
import { FantasyDecisionPoint } from '../models/story';
import { GameState, saveGame } from '../lib/storage';

export interface ResolveDecisionResponse {
  updatedCharacter: FantasyCharacter;
  resultDescription?: string;
  appliedEffects?: Record<string, unknown>;
}

export function useResolveDecisionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ decisionPoint, optionId }: { decisionPoint: FantasyDecisionPoint; optionId: string }) => {
      const currentState = queryClient.getQueryData<GameState>(['fantasy-tycoon', 'game-state']);
      if (!currentState?.character) throw new Error('No character found');
      const res = await fetch('/api/v1/fantasy-tycoon/resolve-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: currentState.character,
          decisionPoint,
          optionId,
        }),
      });
      if (!res.ok) throw new Error('Failed to resolve decision');
      const data: ResolveDecisionResponse = await res.json();
      const updatedState: GameState = {
        ...currentState,
        character: data.updatedCharacter,
        decisionPoint: null,
        genericMessage: null,
        storyEvents: [
          ...currentState.storyEvents,
          ...(data.resultDescription
            ? [{
                id: `result-${Date.now()}`,
                type: 'decision_result',
                description: data.resultDescription,
                characterId: data.updatedCharacter.id,
                locationId: data.updatedCharacter.locationId,
                timestamp: new Date().toISOString(),
              }]
            : []),
        ],
      };
      saveGame(updatedState);
      return { ...data, updatedState };
    },
    onSuccess: ({ updatedState }) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    },
  });
}
