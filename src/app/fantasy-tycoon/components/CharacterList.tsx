"use client";
import React, { useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { FantasyCharacter } from "../models/types";
import CharacterCreation from "./CharacterCreation";

import type { GameStore } from "../hooks/useGameStore";
const EMPTY_ARRAY: FantasyCharacter[] = [];
const selectCharacters = (s: GameStore) => s.gameState?.characters ?? EMPTY_ARRAY;
const selectSelectedCharacter = (s: GameStore) => s.gameState?.character;
const selectSelectCharacter = (s: GameStore) => s.selectCharacter;
const selectDeleteCharacter = (s: GameStore) => s.deleteCharacter;

export default function CharacterList({ onSelect }: { onSelect: (character: FantasyCharacter) => void }) {
  const characters = useGameStore(selectCharacters);
  const selected = useGameStore(selectSelectedCharacter);
  const selectCharacter = useGameStore(selectSelectCharacter);
  const deleteCharacter = useGameStore(selectDeleteCharacter);
  const [showCreation, setShowCreation] = useState(false);

  const handleSelect = (character: FantasyCharacter) => {
    onSelect(character);
    selectCharacter(character.id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteCharacter(id);
  };

  const handleNewCharacter = () => {
    setShowCreation(true);
  };

  const handleCloseCreation = () => {
    setShowCreation(false);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4 p-4 bg-gray-800 rounded shadow">
      <h2 className="text-lg font-bold mb-2 text-white">Your Characters</h2>
      <div className="flex flex-col gap-2">
        {characters.map((char: FantasyCharacter) => (
          <div
            key={char.id}
            className={`flex items-center justify-between px-4 py-2 rounded border transition-colors focus:outline-none ${selected?.id === char.id ? "bg-green-700 border-green-400 text-white" : "bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-700"}`}
          >
            <button type="button" onClick={() => handleSelect(char)} className="text-white font-medium truncate">{char.name}</button>
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Lv.{char.level} {char.race} {char.class}</span>
              <button
                type="button"
                onClick={(e) => handleDelete(e, char.id)}
                className="ml-2 text-red-400 hover:text-red-600 focus:outline-none text-lg px-2"
                aria-label={`Delete ${char.name}`}
              >
                ×
              </button>
            </span>
          </div>
        ))}
        {characters.length < 5 && (
          <button
            type="button"
            onClick={handleNewCharacter}
            className="flex items-center justify-center px-4 py-2 rounded border border-blue-400 bg-blue-700 text-white hover:bg-blue-800 transition-colors"
          >
            + New Character
          </button>
        )}
      </div>
      {showCreation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-900 rounded-lg p-6 shadow-lg w-full max-w-md relative">
            <button
              type="button"
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl"
              onClick={handleCloseCreation}
              aria-label="Close"
            >
              ×
            </button>
            <CharacterCreation />
          </div>
        </div>
      )}
    </div>
  );
}
