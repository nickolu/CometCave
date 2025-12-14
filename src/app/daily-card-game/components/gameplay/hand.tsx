'use client';

import { useGameState } from '@/app/daily-card-game/useGameState';
import { Card } from './card';

export const Hand = () => {
  const { game } = useGameState();
  const { gamePlayState } = game;
  const { dealtCards, selectedCardIds } = gamePlayState;

  return (
    <div>
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
