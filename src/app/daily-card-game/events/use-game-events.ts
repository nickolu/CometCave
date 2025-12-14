'use client';
import { useEffect } from 'react';
import { useGameState } from '@/app/daily-card-game/useGameState';
import { eventEmitter } from './event-emitter';

export const useGameEvents = () => {
  const { setGamePhase, dealHand, selectCard, deselectCard } = useGameState();

  useEffect(() => {
    const unsubRoundStart = eventEmitter.on('ROUND_START', () => {
      console.log('ROUND_START');
      setGamePhase('blindSelection');
    });

    const unsubRoundEnd = eventEmitter.on('ROUND_END', () => {
      console.log('ROUND_END');
    });

    const unsubCardScored = eventEmitter.on('CARD_SCORED', () => {
      console.log('CARD_SCORED');
    });

    const unsubHandDealt = eventEmitter.on('HAND_DEALT', () => {
      console.log('HAND_DEALT');
      dealHand();
    });

    const unsubCardSelected = eventEmitter.on('CARD_SELECTED', event => {
      console.log('CARD_SELECTED', event.id);
      selectCard(event.id);
    });

    const unsubCardDeselected = eventEmitter.on('CARD_DESELECTED', event => {
      console.log('CARD_DESELECTED', event.id);
      deselectCard(event.id);
    });

    return () => {
      unsubRoundStart();
      unsubRoundEnd();
      unsubCardScored();
      unsubHandDealt();
      unsubCardSelected();
      unsubCardDeselected();
    };
  }, [dealHand, selectCard, deselectCard, setGamePhase]);
};
