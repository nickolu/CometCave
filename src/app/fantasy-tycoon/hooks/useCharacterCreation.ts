import { useState } from 'react';
import { FantasyCharacter } from '../models/character';

export function useCharacterCreation() {
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({});
  const [isComplete, setIsComplete] = useState(false);

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }));
  };

  const completeCreation = () => {
    setIsComplete(true);
  };

  return {
    character,
    updateCharacter,
    isComplete,
    completeCreation,
  };
}
