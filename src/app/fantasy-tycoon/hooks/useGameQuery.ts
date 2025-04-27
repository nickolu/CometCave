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

export function useMoveForwardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Get current game state
      const currentState = queryClient.getQueryData<GameState>(['fantasy-tycoon', 'game-state']) || defaultGameState;
      
      // Update the game state (simulate moving forward)
      const eventId = `event-${Date.now()}`;
      const updatedState: GameState = {
        ...currentState,
        character: currentState.character ? {
          ...currentState.character,
          distance: (currentState.character.distance || 0) + 1,
          gold: (currentState.character.gold || 0) + Math.floor(Math.random() * 5),
          reputation: (currentState.character.reputation || 0) + (Math.random() > 0.7 ? 1 : 0)
        } : null,
        storyEvents: [
          ...currentState.storyEvents,
          {
            id: eventId,
            type: 'travel',
            description: generateRandomEvent(currentState.character?.name || 'Adventurer'),
            characterId: currentState.character?.id || 'unknown',
            locationId: currentState.character?.locationId || 'wilderness',
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      // Save to local storage
      saveGame(updatedState);
      
      return updatedState;
    },
    onSuccess: (updatedState) => {
      // Immediately update the cache with the new state
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
      
      // Invalidate the query to trigger a refetch if needed
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] });
    },
  });
}

// Helper function to generate random events
function generateRandomEvent(characterName: string): string {
  const events = [
    `${characterName} found a small treasure chest with some gold.`,
    `${characterName} helped a local farmer and earned some reputation.`,
    `${characterName} traveled through a dense forest.`,
    `${characterName} crossed a river using a rickety bridge.`,
    `${characterName} rested at a small village and heard rumors of adventure.`,
    `${characterName} defeated a small group of bandits.`,
    `${characterName} discovered an ancient ruin.`,
    `${characterName} met a traveling merchant and traded goods.`,
    `${characterName} helped a lost child find their way home.`,
    `${characterName} climbed a tall mountain and enjoyed the view.`
  ];
  
  // Use a deterministic seed for SSR to prevent hydration mismatch
  const index = typeof window !== 'undefined' 
    ? Math.floor(Math.random() * events.length)
    : 0; // Use first event during SSR
  
  return events[index];
}
