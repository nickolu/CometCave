'use client';

import { useEffect } from 'react';

import { Button } from '@/app/components/ui/buutton';

import { useGameStore } from '../hooks/useGameStore';

import { useResolveDecisionMutation } from '../hooks/useResolveDecisionMutation';

import { InventoryPanel } from './InventoryPanel';
import { StoryFeed } from './StoryFeed';
import { useMoveForwardMutation } from '../hooks/useMoveForwardMutation';
import { flipCoin } from '@/app/utils';
import { getGenericTravelMessage } from '../lib/getGenericTravelMessage';
import { LoaderCircle } from 'lucide-react';

function getTravelButtonMessage({ isLoading, distance }: { isLoading: boolean; distance: number }) {
  if (isLoading)
    return (
      <div className="flex items-center mr-2 text-xs justify-center gap-2 w-full">
        <LoaderCircle className="animate-spin" /> Loading...
      </div>
    );
  if (distance === 0) return 'Start Your Adventure';
  return 'Continue Travelling';
}

export default function GameUI() {
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
      moveForwardMutation();
    }
  };

  const handleResolveDecision = (optionId: string) => {
    resolveDecisionMutation({
      decisionPoint: gameState.decisionPoint!,
      optionId: optionId,
      onSuccess: () => {
        setDecisionPoint(null);
      },
    });
  };

  return (
    <div className="w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
      {/* Left column: Game UI */}
      <div className={'space-y-4 rounded-lg'}>
        {gameState.decisionPoint ? (
          <h4 className="font-semibold w-full text-center border text-transform: uppercase">
            Event
          </h4>
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
        {gameState.decisionPoint && !gameState.decisionPoint.resolved && (
          <div>
            <div className="font-semibold mb-6">{gameState.decisionPoint.prompt}</div>
            <div className="space-y-2 mt-2">
              {gameState.decisionPoint.options.map((option: { id: string; text: string }) => {
                if (!option) return null;
                if (!gameState.decisionPoint) return null;
                return (
                  <Button
                    key={option.id}
                    className="block w-full text-left border px-3 py-2 mt-2 rounded disabled:opacity-60"
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
          </div>
        )}
        {gameState.genericMessage && !gameState.decisionPoint && (
          <div className="text-sm">{gameState.genericMessage}</div>
        )}
        {!gameState.decisionPoint && (
          <StoryFeed events={storyEvents} filterCharacterId={selectedCharacterId} />
        )}
      </div>
      <div className="p-4 rounded-lg bg-white h-fit md:sticky md:top-8">
        <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
      </div>
    </div>
  );
}
