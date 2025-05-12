'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FantasyCharacter } from '../models/types';
import { FantasyDecisionPoint } from '../models/types';
import { Item } from '../models/types';
import { useGameStore, useGameStateBuilder } from './useGameStore';

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
  const { getSelectedCharacter } = useGameStore();
  const { addItem, addStoryEvent, commit, updateSelectedCharacter } = useGameStateBuilder();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      decisionPoint,
      optionId,
      onSuccess,
    }: {
      decisionPoint: FantasyDecisionPoint;
      optionId: string;
      onSuccess?: () => void;
    }) => {
      const character = getSelectedCharacter();
      if (!character) throw new Error('No character found');

      const res = await fetch('/api/v1/fantasy-tycoon/resolve-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          decisionPoint,
          optionId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to resolve decision');
      }
      const data: ResolveDecisionResponse = await res.json();

      if (data.updatedCharacter) {
        updateSelectedCharacter(data.updatedCharacter);
      }

      const rewardItems = data.rewardItems ?? [];

      for (const reward of rewardItems) {
        const item = {
          id: reward.id,
          name: reward.name,
          description: reward.description,
          quantity: 1,
        };
        addItem(item);
      }

      const newStoryEvent = {
        decisionPoint,
        id: `result-${Date.now()}`,
        type: 'decision_result',
        characterId: data.updatedCharacter.id,
        locationId: data.updatedCharacter.locationId,
        timestamp: new Date().toISOString(),
        selectedOptionId: data.selectedOptionId,
        selectedOptionText: data.selectedOptionText,
        outcomeDescription: data.outcomeDescription,
        resourceDelta: data.resourceDelta,
      };

      addStoryEvent(newStoryEvent);
      commit();
      onSuccess?.();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    },
  });
}
