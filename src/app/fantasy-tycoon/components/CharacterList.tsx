"use client";
import React, { useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { FantasyCharacter } from "../models/types";
import CharacterCreation from "./CharacterCreation";
import CharacterCard from "./CharacterCard";
import AddCharacterCard from "./AddCharacterCard";

import type { GameStore } from "../hooks/useGameStore";
const EMPTY_ARRAY: FantasyCharacter[] = [];
const selectCharacters = (s: GameStore) => s.gameState?.characters ?? EMPTY_ARRAY;
const selectSelectedCharacterId = (s: GameStore) => s.gameState?.selectedCharacterId;
const selectSelectCharacter = (s: GameStore) => s.selectCharacter;
const selectDeleteCharacter = (s: GameStore) => s.deleteCharacter;

export default function CharacterList() {
  const characters = useGameStore(selectCharacters);
  const selectedCharacterId = useGameStore(selectSelectedCharacterId);
  const selectCharacter = useGameStore(selectSelectCharacter);
  const deleteCharacter = useGameStore(selectDeleteCharacter);
  const [showCreation, setShowCreation] = useState(false);

  const handleSelect = (character: FantasyCharacter) => {
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
    <div className="w-full max-w-4xl mx-auto p-4 bg-gray-800 rounded shadow">
      <h2 className="text-lg font-bold mb-4 text-white">Your Characters</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {characters.map((char: FantasyCharacter) => (
          <CharacterCard
            key={char.id}
            character={char}
            selected={selectedCharacterId === char.id}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        ))}
        {characters.length < 5 && (
          <AddCharacterCard onClick={handleNewCharacter} />
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
            <CharacterCreation onComplete={handleCloseCreation} />
          </div>
        </div>
      )}
    </div>
  );
}
