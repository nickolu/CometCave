'use client';

import { Hand } from '@/app/daily-card-game/components/gameplay/hand';
import { useGameState } from '@/app/daily-card-game/useGameState';
import { Button } from '@/components/ui/button';

export function GamePlayView() {
  const { setGamePhase } = useGameState();
  return (
    <div>
      <h1>Game Play</h1>
      <Button
        onClick={() => {
          setGamePhase('shop');
        }}
      >
        End Game
      </Button>
      <Hand />
    </div>
  );
}
