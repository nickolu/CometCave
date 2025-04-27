"use client";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FantasyCharacter } from '../models/character';
import { FantasyDecisionPoint } from '../models/story';
import { GameState } from '../models/types';
import { saveGame } from '../lib/storage';
import { addItem } from '../lib/inventory';
import { getItemDisplayData } from '../lib/itemDisplay';

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
  rewardItems?: { id: string; qty: number }[];
}

export function useResolveDecisionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ decisionPoint, optionId }: { decisionPoint: FantasyDecisionPoint; optionId: string }) => {
      console.log('[ResolveDecisionMutation] mutationFn called', { decisionPoint, optionId });
      const currentState = queryClient.getQueryData<GameState>(['fantasy-tycoon', 'game-state']);
      if (!currentState?.character) throw new Error('No character found');
      console.log('[ResolveDecisionMutation] Fetching /api/v1/fantasy-tycoon/resolve-decision', currentState.character, { decisionPoint, optionId });
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
        console.log('[ResolveDecisionMutation] Fetch failed', res.status, res.statusText);
        throw new Error('Failed to resolve decision');
      }
      const data: ResolveDecisionResponse = await res.json();
      console.log('[ResolveDecisionMutation] Response data:', data);
      // Patch: Add rewardItems to inventory if present
      let newInventory = currentState.inventory;
      console.log('[ResolveDecisionMutation] Initial inventory:', newInventory);
      if (data.rewardItems && Array.isArray(data.rewardItems)) {
        console.log('[ResolveDecisionMutation] data.rewardItems present:', data.rewardItems);
        console.log('[ResolveDecisionMutation] rewardItems extracted:', data.rewardItems);
        if (data.rewardItems.length === 0) {
        console.log('[ResolveDecisionMutation] No reward items extracted.');
      }
      for (const reward of data.rewardItems) {
          const display = getItemDisplayData(reward.id);
          console.log('[ResolveDecisionMutation] Display data for', reward.id, display);
          const item = {
            id: reward.id,
            ...display,
            quantity: reward.qty,
          };
          const beforeInventory = newInventory;
          newInventory = addItem({ ...currentState, inventory: newInventory }, item).inventory;
          console.log('[ResolveDecisionMutation] Added item to inventory:', item, '\nBefore:', beforeInventory, '\nAfter:', newInventory);
        }
      }
      console.log('[ResolveDecisionMutation] About to save updated state', {
        inventory: newInventory,
        character: data.updatedCharacter,
        decisionPoint: null,
        genericMessage: null,
        storyEventsLength: (currentState.storyEvents?.length ?? 0) + 1
      });
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
      console.log('[ResolveDecisionMutation] Final updated state:', updatedState);
      saveGame(updatedState);
      return { ...data, updatedState };
    },
    onSuccess: ({ updatedState }) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    },
  });
}
