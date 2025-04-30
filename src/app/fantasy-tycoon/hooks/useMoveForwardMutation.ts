"use client";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GameState, Item } from '../models/types';
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
  const { setGameState, gameState } = useGameStore();
  
  return useMutation({
    mutationFn: async () => {
      
      const currentCharacter = gameState?.character;
      if (!currentCharacter) throw new Error('No character found');
      
      const res = await fetch('/api/v1/fantasy-tycoon/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: currentCharacter })
      });
      
      if (!res.ok) {
        throw new Error('Failed to move forward');
      }
      
      const data: MoveForwardResponse = await res.json();
      let newInventory = gameState.inventory;
      
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
        newInventory = addItem({ ...gameState, inventory: newInventory }, item).inventory;
      }
      
      const updatedState: GameState = {
        ...gameState,
        character: data.character,
        storyEvents: [
          ...gameState.storyEvents,
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

