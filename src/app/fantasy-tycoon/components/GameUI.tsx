"use client";
import { useGameQuery, useMoveForwardMutation } from "../hooks/useGameQuery";
import StoryFeed from "../components/StoryFeed";
import CharacterCreation from "../components/CharacterCreation";
import { useState, useEffect } from "react";
import { saveGame, GameState } from "../lib/storage";
import { FantasyCharacter } from "../models/character";

export default function GameUI() {
  const { data: initialGameState, isLoading: loadingState } = useGameQuery();
  const moveForwardMutation = useMoveForwardMutation();
  const [gameState, setGameState] = useState<GameState | undefined>(initialGameState);

  // Update local state when the query data changes
  useEffect(() => {
    if (initialGameState) {
      setGameState(initialGameState);
    }
  }, [initialGameState]);

  const loading = loadingState || moveForwardMutation.isPending;

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!gameState) return <div className="p-4 text-center">Creating new game...</div>;

  const { character, storyEvents } = gameState;

  const handleCharacterCreated = (newCharacter: FantasyCharacter) => {
    if (!gameState) return;
    
    const updatedState: GameState = {
      ...gameState,
      character: newCharacter
    };
    setGameState(updatedState);
    saveGame(updatedState);
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
          disabled={moveForwardMutation.isPending}
        >
          {moveForwardMutation.isPending ? "Moving..." : "Move Forward"}
        </button>
        <div className="flex gap-4 text-sm">
          <span>Distance: <b>{character.distance}</b> km</span>
          <span>Gold: <b>{character.gold}</b></span>
          <span>Rep: <b>{character.reputation}</b></span>
        </div>
      </div>
      <StoryFeed events={storyEvents} />
    </div>
  );
}
