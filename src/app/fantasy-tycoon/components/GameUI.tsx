"use client";
import { useGameQuery, useMoveForwardMutation } from "../hooks/useGameQuery";
import { useResolveDecisionMutation } from "../hooks/useResolveDecisionMutation";
import StoryFeed from "../components/StoryFeed";
import CharacterCreation from "../components/CharacterCreation";
import { useEffect, useState, useCallback } from "react";
import InventoryPanel from "./InventoryPanel";
import { useQueryClient } from '@tanstack/react-query';
import { FantasyCharacter } from "../models/character";
import { useGameState } from "../hooks/useGameState";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import CharacterList from "./CharacterList";

export default function GameUI() {
  const { save } = useGameState();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const toggleInventory = useCallback(() => setInventoryOpen(v => !v), []);
  // Keyboard shortcut: I to toggle inventory
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "i") {
        setInventoryOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
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

  const handleCharacterSelect = (character: FantasyCharacter) => {
    const updatedState = { ...gameState, character };
    save(updatedState);
    queryClient.setQueryData(['fantasy-tycoon', 'game-state'], updatedState);
  };


  if (!character) {
    
    return <CharacterList onSelect={handleCharacterSelect} />;
  }

  return (
    <>
    <div className="max-w-md mx-auto p-4 space-y-4">
      <Button
        className="w-full"
        onClick={() => moveForwardMutation.mutate()}
        disabled={moveForwardMutation.isPending || resolveDecisionMutation.isPending}
      >
        {moveForwardMutation.isPending ? "Travelling..." : "Continue Travelling"}
      </Button>
      <div className="flex justify-between items-center gap-2">
        <Button
          variant="secondary"
          className="mr-2"
          onClick={toggleInventory}
          aria-label="Open inventory (I)"
        >
          Inventory (I)
        </Button>
       
        <div className="flex gap-4 text-sm">
          <span>Distance: <b>{character.distance}</b> km</span>
          <span>Gold: <b>{character.gold}</b></span>
          <span>Rep: <b>{character.reputation}</b></span>
        </div>
      </div>
      {gameState.decisionPoint && !gameState.decisionPoint.resolved && (
        <Card>
          <div className="font-semibold mb-2">{gameState.decisionPoint.prompt}</div>
          <div className="space-y-2">
            {gameState.decisionPoint.options.map((option: { id: string; text: string }) => 
             {
              if (!option) return null;
              if (!gameState.decisionPoint) return null;
              return <Button
                key={option.id}
                className="block w-full text-left border px-3 py-2 rounded disabled:opacity-60"
                disabled={resolveDecisionMutation.isPending}
                onClick={() => resolveDecisionMutation.mutate({ decisionPoint: gameState.decisionPoint!, optionId: option.id })}
              >
                {option.text}
              </Button>}
            )}
          </div>
          {resolveDecisionMutation.isPending && <div className="text-xs text-gray-500 mt-2">Resolving...</div>}
          {resolveDecisionMutation.data && (
            <div className="mt-3 text-green-700 text-sm">
              {resolveDecisionMutation.data.resultDescription || "Decision resolved!"}
            </div>
          )}
        </Card>
      )}
      <StoryFeed events={storyEvents} />
      {gameState.genericMessage && (
        <Card className="bg-gray-100 text-gray-700 text-sm">
          {gameState.genericMessage}
        </Card>
      )}
    </div>
    <InventoryPanel isOpen={inventoryOpen} onClose={toggleInventory} inventory={gameState?.inventory ?? []} />
    </>
  );
}

