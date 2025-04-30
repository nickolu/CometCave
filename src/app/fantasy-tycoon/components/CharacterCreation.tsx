"use client";
import React from 'react';
import { useCharacterCreation } from '../hooks/useCharacterCreation';
import { useCallback } from 'react';

import { FantasyCharacter } from '../models/types';

export default function CharacterCreation({ onComplete }: { onComplete?: (character: Partial<FantasyCharacter>) => void }) {
  const { character, updateCharacter, completeCreation } = useCharacterCreation();

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    completeCreation();
    onComplete?.(character);
  }, [completeCreation, character, onComplete]);

  return (
    <form className="space-y-4 p-4" onSubmit={handleSubmit}>
      <input
        className="w-full p-2 border rounded text-black"
        placeholder="Name"
        value={character.name || ''}
        onChange={e => updateCharacter({ name: e.target.value })}
        required
      />
      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
        Add Character
      </button>
    </form>
  );
}
