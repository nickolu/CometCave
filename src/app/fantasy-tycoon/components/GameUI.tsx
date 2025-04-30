"use client";

import { useEffect, useState } from "react";

import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";

import { useGameStore } from "../hooks/useGameStore";

import { useResolveDecisionMutation } from "../hooks/useResolveDecisionMutation";

import InventoryPanel from "./InventoryPanel";  
import StoryFeed from "./StoryFeed";
import { useMoveForwardMutation } from '../hooks/useMoveForwardMutation';
import Link from 'next/link';
import { flipCoin } from "@/app/utils";
import { getGenericTravelMessage } from "../lib/getGenericTravelMessage";

export default function GameUI() {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  
  
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "i") {
        setInventoryOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setInventoryOpen]);

  const { gameState, setGenericMessage, incrementDistance } = useGameStore();
  
  const {mutate: moveForwardMutation, isPending: moveForwardPending} = useMoveForwardMutation();
  const {mutate: resolveDecisionMutation, isPending: resolveDecisionPending} = useResolveDecisionMutation();

  useEffect(() => {
    if (typeof window !== 'undefined' && gameState) {}
  }, [gameState]);

  if (!gameState) return <div className="p-4 text-center">No game found.</div>;

  const { character, storyEvents } = gameState;

  if (!character) {
    return <div>
      please select a <Link href="/fantasy-tycoon/characters">character</Link>
    </div>
  }

  const handleMoveForward = () => {
    const shouldDoNothing = flipCoin(0.05, 0.95);
    if (shouldDoNothing) {
      console.log('not calling LLM');
      const genericMessage = getGenericTravelMessage();
      setGenericMessage(genericMessage);
      incrementDistance();
    } else {
      console.log('calling LLM');
      moveForwardMutation();
    }
  };

  return (
    <>
    <div className="max-w-md mx-auto p-4 space-y-4">
      <Button
        className="w-full"
        onClick={handleMoveForward}
        disabled={moveForwardPending || resolveDecisionPending}
      >
        {moveForwardPending ? "Travelling..." : "Continue Travelling"}
      </Button>
      {resolveDecisionPending && <div className="text-xs text-gray-500 mt-2">Resolving...</div>}
      <div className="flex justify-between items-center gap-2">
        <Button
          variant="secondary"
          className="mr-2"
          onClick={() => setInventoryOpen(v => !v)}
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
                disabled={resolveDecisionPending}
                onClick={() => resolveDecisionMutation({ decisionPoint: gameState.decisionPoint!, optionId: option.id })}
              >
                {option.text}
              </Button>}
            )}
          </div>
          {resolveDecisionPending && <div className="text-xs text-gray-500 mt-2">Resolving...</div>}
        </Card>
      )}
      <StoryFeed events={storyEvents} />
      {gameState.genericMessage && (
        <Card className="bg-gray-100 text-gray-700 text-sm">
          {gameState.genericMessage}
        </Card>
      )}
    </div>
    <InventoryPanel isOpen={inventoryOpen} onClose={() => setInventoryOpen(false)} inventory={gameState?.inventory ?? []} />
    </>
  );
}

