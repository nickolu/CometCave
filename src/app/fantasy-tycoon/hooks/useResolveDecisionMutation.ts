"use client";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FantasyCharacter } from '../models/types';
import { FantasyDecisionPoint } from '../models/types';
import { GameState, Item } from '../models/types';
import { addItem } from '../lib/inventory';
import { useGameStore } from './useGameStore';

export interface ResolveDecisionResponse {
  updatedCharacter: FantasyCharacter;
  resultDescription?: string;
  appliedEffects?: Record<string, unknown>;
  selectedOptionId?: string;
  selectedOptionText?: string;
  outcomeDescription?: string;
  resourceDelta?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
  };
  rewardItems?: Item[];
}

export function useResolveDecisionMutation() {
  const { setGameState } = useGameStore();
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

      if (!res.ok) {
        throw new Error('Failed to resolve decision');
      }
      const data: ResolveDecisionResponse = await res.json();
      
      let newInventory = currentState.inventory;
      
      if (data.rewardItems && Array.isArray(data.rewardItems)) {
        if (data.rewardItems.length === 0) {
      }

      for (
        const reward of data.rewardItems) {
          const item = {
            id: reward.id,
            name: reward.name,
            description: reward.description,
            quantity: 1,
          };
          newInventory = addItem({ ...currentState, inventory: newInventory }, item).inventory;
        }
      }
      
      const updatedState: GameState = {
        ...currentState,
        character: data.updatedCharacter,
        decisionPoint: null,
        genericMessage: null,
        inventory: newInventory,
        storyEvents: [
          ...currentState.storyEvents,
          ...(data.selectedOptionId && data.selectedOptionText && data.outcomeDescription
            ? [{
                id: `result-${Date.now()}`,
                type: 'decision_result',
                description: `${data.updatedCharacter.name} chose: "${data.selectedOptionText}" → ${data.outcomeDescription}`,
                characterId: data.updatedCharacter.id,
                locationId: data.updatedCharacter.locationId,
                timestamp: new Date().toISOString(),
                selectedOptionId: data.selectedOptionId,
                selectedOptionText: data.selectedOptionText,
                outcomeDescription: data.outcomeDescription,
                resourceDelta: data.resourceDelta,
              }]
            : data.resultDescription
              ? [{
                  id: `result-${Date.now()}`,
                  type: 'decision_result',
                  description: `${data.updatedCharacter.name} ${data.resultDescription}`,
                  characterId: data.updatedCharacter.id,
                  locationId: data.updatedCharacter.locationId,
                  timestamp: new Date().toISOString(),
                }]
              : []),
        ],
      };
      
      return { ...data, updatedState };
    },
    onSuccess: ({ updatedState }) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
      setGameState(updatedState);
    },
  });
}
