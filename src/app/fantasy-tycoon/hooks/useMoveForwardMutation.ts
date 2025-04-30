"use client";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GameState, Item } from '../models/types';
import { defaultGameState } from '../lib/defaultGameState';
import { addItem } from '../lib/inventory';
import { useGameStore } from './useGameStore';

export interface MoveForwardResponse {
  character: import('../models/character').FantasyCharacter;
  event?: import('../models/story').FantasyStoryEvent | null;
  decisionPoint?: import('../models/story').FantasyDecisionPoint | null;
  genericMessage?: string | null;
}


export function useMoveForwardMutation() {
  const queryClient = useQueryClient();
  const { setGameState } = useGameStore();
  
  return useMutation({
    mutationFn: async () => {
      const currentState = queryClient.getQueryData<GameState>(['fantasy-tycoon', 'game-state']) || defaultGameState;
      if (!currentState.character) throw new Error('No character found');
      
      const res = await fetch('/api/v1/fantasy-tycoon/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: currentState.character })
      });
      
      if (!res.ok) {
        throw new Error('Failed to move forward');
      }
      
      const data: MoveForwardResponse = await res.json();
      let newInventory = currentState.inventory;
      
      const rewardItems: Item[] = [];
      if (data.event) {
        if (data.event.resourceDelta && Array.isArray(data.event.resourceDelta.rewardItems)) {
          rewardItems.push(...data.event.resourceDelta.rewardItems);
        }
        if (Array.isArray(data.event.rewardItems)) {
          rewardItems.push(...data.event.rewardItems);
        }
      }
      
      for (const reward of rewardItems) {
        const item: Item = {
          id: reward.id,
          name: reward.name ?? '',
          description: reward.description ?? '',
          quantity: reward.quantity,
        };
        newInventory = addItem({ ...currentState, inventory: newInventory }, item).inventory;
      }
      
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

      setGameState(updatedState);
      return updatedState;
    },
    onSuccess: (updatedState) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    }
  });
}

