"use client";
import { useState, useId } from 'react';
import { FantasyCharacter, FantasyAbility } from '../models/character';

export function useCharacterCreation() {
  // useId generates a stable ID that's consistent between server and client
  const idPrefix = useId();
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({});
  const [isComplete, setIsComplete] = useState(false);

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }));
  };

  const completeCreation = () => {
    // Use stable IDs for server-side rendering consistency
    const abilityId = `${idPrefix}-ability`;
    const charId = `${idPrefix}-char`;
    
    // Ensure all required fields are set with defaults if not provided
    const defaultAbility: FantasyAbility = {
      id: abilityId,
      name: 'Basic Attack',
      description: 'A simple attack with your weapon',
      power: 1,
      cooldown: 0
    };
    
    setCharacter(prev => ({
      ...prev,
      id: prev.id || charId,
      playerId: prev.playerId || 'player-1',
      name: prev.name || 'Adventurer',
      race: prev.race || 'Human',
      class: prev.class || 'Warrior',
      level: prev.level || 1,
      abilities: prev.abilities || [defaultAbility],
      locationId: prev.locationId || 'starting-village',
      gold: prev.gold || 10,
      reputation: prev.reputation || 0,
      distance: prev.distance || 0,
      status: prev.status || 'active'
    }));
    
    setIsComplete(true);
  };

  return {
    character,
    updateCharacter,
    isComplete,
    completeCreation,
  };
}
