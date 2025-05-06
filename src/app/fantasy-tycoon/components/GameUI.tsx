'use client';

import { useEffect, useState } from 'react';

import { Card } from '@/app/components/ui/caard';
import { Button } from '@/app/components/ui/buutton';

import { useGameStore } from '../hooks/useGameStore';

import { useResolveDecisionMutation } from '../hooks/useResolveDecisionMutation';

import { InventoryPanel } from './InventoryPanel';
import { StoryFeed } from './StoryFeed';
import { useMoveForwardMutation } from '../hooks/useMoveForwardMutation';
import { flipCoin } from '@/app/utils';
import { getGenericTravelMessage } from '../lib/getGenericTravelMessage';
import { CircularProgress } from '@mui/material';

function getTravelButtonMessage({ isLoading, distance }: { isLoading: boolean; distance: number }) {
  if (isLoading) return 'Travelling...';
  if (distance === 0) return 'Start Your Adventure';
  return 'Continue Travelling';
}

export default function GameUI() {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [isInEventState, setIsInEventState] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'i') {
        setInventoryOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setInventoryOpen]);

  const {
    gameState,
    getSelectedCharacter,
    setGenericMessage,
    incrementDistance,
    setDecisionPoint,
  } = useGameStore();

  const { mutate: moveForwardMutation, isPending: moveForwardPending } = useMoveForwardMutation();
  const { mutate: resolveDecisionMutation, isPending: resolveDecisionPending } =
    useResolveDecisionMutation();

  useEffect(() => {
    if (typeof window !== 'undefined' && gameState) {
    }
  }, [gameState]);

  if (!gameState) return <div className="p-4 text-center">No game found.</div>;

  const { selectedCharacterId, storyEvents } = gameState;

  if (!selectedCharacterId) {
    return <div>please select a character</div>;
  }

  const handleMoveForward = () => {
    const shouldDoNothing = flipCoin(0.05, 0.95);
    if (shouldDoNothing) {
      const genericMessage = getGenericTravelMessage();
      setGenericMessage(genericMessage);
      incrementDistance();
    } else {
      setIsInEventState(true);
      moveForwardMutation();
    }
  };

  const handleResolveDecision = (optionId: string) => {
    setIsInEventState(false);
    resolveDecisionMutation({
      decisionPoint: gameState.decisionPoint!,
      optionId: optionId,
      onSuccess: () => {
        setDecisionPoint(null);
      },
    });
  };

  return (
    <>
      <div
        className={
          isInEventState
            ? 'max-w-md mx-auto p-4 space-y-4 border border-green-200'
            : 'max-w-md mx-auto p-4 space-y-4'
        }
      >
        {isInEventState ? (
          <>
            <h3 className="text-center flex justify-center">
              <span>Event {moveForwardPending ? 'Loading...' : 'In Progress'}</span>
              {moveForwardPending && <CircularProgress size={2} />}
            </h3>
          </>
        ) : (
          <Button
            className="w-full hover:bg-blue-950 hover:shadow-md transition-all duration-300 active:translate-y-1/8 active:ring-1 active:ring-blue-850"
            onClick={handleMoveForward}
            disabled={moveForwardPending || resolveDecisionPending}
          >
            {getTravelButtonMessage({
              isLoading: moveForwardPending,
              distance: getSelectedCharacter()?.distance ?? 0,
            })}
          </Button>
        )}
        {resolveDecisionPending && <div className="text-xs text-gray-500 mt-2">Resolving...</div>}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="mr-2"
            onClick={() => setInventoryOpen(v => !v)}
            aria-label="Open inventory (I)"
          >
            Inventory (I)
          </Button>
        </div>
        {gameState.decisionPoint && !gameState.decisionPoint.resolved && (
          <Card>
            <div className="font-semibold mb-2">{gameState.decisionPoint.prompt}</div>
            <div className="space-y-2">
              {gameState.decisionPoint.options.map((option: { id: string; text: string }) => {
                if (!option) return null;
                if (!gameState.decisionPoint) return null;
                return (
                  <Button
                    key={option.id}
                    className="block w-full text-left border px-3 py-2 rounded disabled:opacity-60"
                    disabled={resolveDecisionPending}
                    onClick={() => {
                      handleResolveDecision(option.id);
                    }}
                  >
                    {option.text}
                  </Button>
                );
              })}
            </div>
            {resolveDecisionPending && (
              <div className="text-xs text-gray-500 mt-2">Resolving...</div>
            )}
          </Card>
        )}
        <StoryFeed events={storyEvents} filterCharacterId={selectedCharacterId} />
        {gameState.genericMessage && (
          <Card className="bg-gray-100 text-gray-700 text-sm">{gameState.genericMessage}</Card>
        )}
      </div>
      <InventoryPanel
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        inventory={getSelectedCharacter()?.inventory ?? []}
      />
    </>
  );
}
