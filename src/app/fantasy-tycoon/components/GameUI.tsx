"use client";
import { useGameQuery, useMoveForwardMutation } from "../hooks/useGameQuery";
import { useResolveDecisionMutation } from "../hooks/useResolveDecisionMutation";
import StoryFeed from "../components/StoryFeed";
import CharacterCreation from "../components/CharacterCreation";
import { useEffect } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { saveGame } from "../lib/storage";
import { FantasyCharacter } from "../models/character";

export default function GameUI() {
  const queryClient = useQueryClient();
  const { data: gameState, isLoading: loadingState } = useGameQuery();
  const moveForwardMutation = useMoveForwardMutation();
  const resolveDecisionMutation = useResolveDecisionMutation();

  // Use useEffect to ensure client-side only code
  useEffect(() => {
    // Initialize the game on the client side if needed
    if (typeof window !== 'undefined' && gameState && !loadingState) {
      // This ensures any client-side only initialization happens after hydration
    }
  }, [gameState, loadingState]);

  if (!gameState) return <div className="p-4 text-center">No game found.</div>;

  const { character, storyEvents } = gameState;
  const lastEvent = storyEvents && storyEvents.length > 0 ? storyEvents[storyEvents.length - 1] : null;
  // Find if there is an active decision point in the last event
  const decisionPoint = gameState.decisionPoint;
  const genericMessage = gameState.genericMessage;

  const handleCharacterCreated = (newCharacter: FantasyCharacter) => {
    const updatedState = { ...gameState, character: newCharacter };
    saveGame(updatedState);
    queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
  };


  if (!character) {
    return <CharacterCreation onComplete={handleCharacterCreated} />;
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center gap-2">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => moveForwardMutation.mutate()}
          disabled={moveForwardMutation.isPending || resolveDecisionMutation.isPending}
        >
          {moveForwardMutation.isPending ? "Moving..." : "Move Forward"}
        </button>
        <div className="flex gap-4 text-sm">
          <span>Distance: <b>{character.distance}</b> km</span>
          <span>Gold: <b>{character.gold}</b></span>
          <span>Rep: <b>{character.reputation}</b></span>
        </div>
      </div>
      {/* Sprint 4: Decision/Event UI */}
      {gameState.decisionPoint && !gameState.decisionPoint.resolved && (
        <div className="border rounded p-4 bg-yellow-50">
          <div className="font-semibold mb-2">{gameState.decisionPoint.prompt}</div>
          <div className="space-y-2">
            {gameState.decisionPoint.options.map(option => (
              <button
                key={option.id}
                className="block w-full text-left border px-3 py-2 rounded hover:bg-yellow-100 focus:bg-yellow-200 disabled:opacity-60"
                disabled={resolveDecisionMutation.isPending}
                onClick={() => resolveDecisionMutation.mutate({ decisionPoint: gameState.decisionPoint, optionId: option.id })}
              >
                {option.text}
              </button>
            ))}
          </div>
          {resolveDecisionMutation.isPending && <div className="text-xs text-gray-500 mt-2">Resolving...</div>}
          {resolveDecisionMutation.data && (
            <div className="mt-3 text-green-700 text-sm">
              {resolveDecisionMutation.data.resultDescription || "Decision resolved!"}
            </div>
          )}
        </div>
      )}
      {/* Handle generic message for roll = 0 */}
      {gameState.genericMessage && (
        <div className="border rounded p-3 bg-gray-100 text-gray-700 text-sm">
          {gameState.genericMessage}
        </div>
      )}
      <StoryFeed events={storyEvents} />
    </div>
  );
}

