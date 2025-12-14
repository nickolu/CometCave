'use client';

import { useGameState } from '@/app/daily-card-game/useGameState';
import { Card } from '@/app/daily-card-game/components/card';
import { eventEmitter } from '../../events/event-emitter';
import { Button } from '@/components/ui/button';

export const Hand = () => {
  const { game } = useGameState();
  const { gamePlayState } = game;
  const { dealtCards } = gamePlayState;
  const selectedCardIds = gamePlayState.selectedCardIds;

  return (
    <div>
      <Button
        onClick={() => {
          eventEmitter.emit({ type: 'HAND_DEALT' });
        }}
      >
        Deal
      </Button>
      <div className="flex flex-wrap gap-2">
        {dealtCards.map((card, index) => (
          <Card
            key={card.id}
            playingCard={card}
            handIndex={index}
            isSelected={selectedCardIds.includes(card.id)}
          />
        ))}
      </div>
    </div>
  );
};
