import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GameState } from '../lib/storage';

export function useGameQuery() {
  return useQuery<GameState | null>({
    queryKey: ['fantasy-tycoon', 'game-state'],
    queryFn: async () => {
      const res = await fetch('/api/v1/fantasy-tycoon/game-state');
      if (!res.ok) throw new Error('Failed to fetch game state');
      return res.json();
    },
    staleTime: 1000 * 60,
  });
}

export function useMoveForwardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/fantasy-tycoon/move-forward', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to move forward');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['fantasy-tycoon', 'game-state'], data.state);
    },
  });
}
