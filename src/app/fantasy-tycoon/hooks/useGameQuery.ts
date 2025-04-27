"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GameState, Item } from '../models/types';
import { useGameState } from './useGameState';
import { defaultGameState } from '../lib/defaultGameState';
import { addItem } from '../lib/inventory';

export function useGameQuery() {
  const { gameState } = useGameState();
  return useQuery<GameState>({
    queryKey: ['fantasy-tycoon', 'game-state'],
    queryFn: async () => {
      // Use useGameState for persisted state
      return gameState || defaultGameState;
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
  const { save } = useGameState();
  return useMutation({
    mutationFn: async () => {
      console.log('[MoveForwardMutation] mutationFn called');
      const currentState = queryClient.getQueryData<GameState>(['fantasy-tycoon', 'game-state']) || defaultGameState;
      if (!currentState.character) throw new Error('No character found');
      console.log('[MoveForwardMutation] Fetching /api/v1/fantasy-tycoon/move-forward', currentState.character);
      const res = await fetch('/api/v1/fantasy-tycoon/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: currentState.character })
      });
      if (!res.ok) {
        console.log('[MoveForwardMutation] Fetch failed', res.status, res.statusText);
        throw new Error('Failed to move forward');
      }
      const data: MoveForwardResponse = await res.json();
      console.log('[MoveForwardMutation] Response data:', data);
      let newInventory = currentState.inventory;
      console.log('[MoveForwardMutation] Initial inventory:', newInventory);
      // Patch: Add rewardItems from event.resourceDelta and event.rewardItems if present
      const rewardItems: Item[] = [];
      if (data.event) {
        console.log('[MoveForwardMutation] data.event present:', data.event);
        if (data.event.resourceDelta && Array.isArray(data.event.resourceDelta.rewardItems)) {
          console.log('[MoveForwardMutation] resourceDelta rewardItems:', data.event.resourceDelta.rewardItems)
          rewardItems.push(...data.event.resourceDelta.rewardItems);
        }
        if (Array.isArray(data.event.rewardItems)) {
          rewardItems.push(...data.event.rewardItems);
        }
      }
      console.log('[MoveForwardMutation] rewardItems extracted:', rewardItems);
      if (rewardItems.length === 0) {
        console.log('[MoveForwardMutation] No reward items extracted.');
      }
      for (const reward of rewardItems) {
        console.log('[MoveForwardMutation] Display data for', reward.id, reward);
        const item: Item = {
          id: reward.id,
          name: reward.name ?? '',
          description: reward.description ?? '',
          quantity: reward.quantity,
        };
        const beforeInventory = newInventory;
        newInventory = addItem({ ...currentState, inventory: newInventory }, item).inventory;
        console.log('[MoveForwardMutation] Added item to inventory:', item, '\nBefore:', beforeInventory, '\nAfter:', newInventory);
      }
      console.log('[MoveForwardMutation] About to save updated state', {
        inventory: newInventory,
        character: data.character,
        storyEventsLength: (currentState.storyEvents?.length ?? 0) + (data.event ? 1 : 0),
        decisionPoint: data.decisionPoint,
        genericMessage: data.genericMessage
      });
      const updatedState: GameState = {
        ...currentState,
        character: data.character,
        storyEvents: [
          ...currentState.storyEvents,
          ...(data.event ? [data.event] : [])
        ],
        decisionPoint: data.decisionPoint ?? null,
        genericMessage: data.genericMessage ?? null,
        inventory: newInventory,
      };

      console.log('[MoveForwardMutation] Final updated state:', updatedState);
      save(updatedState);
      return updatedState;
    },
    onSuccess: (updatedState) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    }
  });
}

