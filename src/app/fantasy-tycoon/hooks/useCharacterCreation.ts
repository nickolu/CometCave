"use client";
import { useState } from 'react';
import { FantasyCharacter, FantasyAbility } from '../models/types';
import {
  DEFAULT_CHARACTER_NAME,
  DEFAULT_ABILITY_NAME,
  DEFAULT_ABILITY_DESCRIPTION,
  DEFAULT_ABILITY_POWER,
  DEFAULT_ABILITY_COOLDOWN,
} from '../config/gameDefaults';
import { useGameStore } from '../hooks/useGameStore';

export function useCharacterCreation() {
  const {addCharacter} = useGameStore();
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({});
  const [isComplete, setIsComplete] = useState(false);

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }));
  };

  const completeCreation = () => {
    const charId = crypto.randomUUID();
    const abilityId = crypto.randomUUID();
    
    const defaultAbility: FantasyAbility = {
      id: abilityId,
      name: DEFAULT_ABILITY_NAME,
      description: DEFAULT_ABILITY_DESCRIPTION,
      power: DEFAULT_ABILITY_POWER,
      cooldown: DEFAULT_ABILITY_COOLDOWN  
    };

    const updatedCharacter = {
      ...character,
      id: charId,
      name: character.name || DEFAULT_CHARACTER_NAME,
      abilities: [defaultAbility],
    };
    
    
    console.log("completeCreation", updatedCharacter);
    addCharacter(updatedCharacter);
    setIsComplete(true);
  };

  return {
    character,
    updateCharacter,
    isComplete,
    completeCreation,
  };
}
