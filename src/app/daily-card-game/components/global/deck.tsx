'use client';

import { useGameState } from '@/app/daily-card-game/useGameState';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Deck = () => {
  const { game } = useGameState();
  const { gamePlayState, fullDeck } = game;
  const { remainingDeck } = gamePlayState;
  const [deckType, setDeckType] = useState<'remaining' | 'full'>('remaining');

  const deck = deckType === 'remaining' ? remainingDeck : fullDeck;

  return (
    <div>
      <Button onClick={() => setDeckType(deckType === 'remaining' ? 'full' : 'remaining')}>
        Show {deckType === 'remaining' ? 'Full' : 'Remaining'} Deck
      </Button>
      {deck.map(card => (
        <p key={card.id}>
          {card.value} {card.suit}
        </p>
      ))}
    </div>
  );
};
