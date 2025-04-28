"use client";
import { useState, useId } from 'react';
import { FantasyCharacter, FantasyAbility } from '../models/types';
import {
  DEFAULT_PLAYER_ID,
  DEFAULT_CHARACTER_NAME,
  DEFAULT_CHARACTER_RACE,
  DEFAULT_CHARACTER_CLASS,
  DEFAULT_CHARACTER_LEVEL,
  DEFAULT_CHARACTER_LOCATION_ID,
  DEFAULT_CHARACTER_GOLD,
  DEFAULT_CHARACTER_REPUTATION,
  DEFAULT_CHARACTER_DISTANCE,
  DEFAULT_CHARACTER_STATUS,
  DEFAULT_ABILITY_NAME,
  DEFAULT_ABILITY_DESCRIPTION,
  DEFAULT_ABILITY_POWER,
  DEFAULT_ABILITY_COOLDOWN,
  DEFAULT_STAT_MIN,
  DEFAULT_STAT_MAX
} from '../config/gameDefaults';

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
      name: DEFAULT_ABILITY_NAME,
      description: DEFAULT_ABILITY_DESCRIPTION,
      power: DEFAULT_ABILITY_POWER,
      cooldown: DEFAULT_ABILITY_COOLDOWN
    };
    
    setCharacter(prev => ({
      ...prev,
      id: prev.id || charId,
      playerId: prev.playerId || DEFAULT_PLAYER_ID,
      name: prev.name || DEFAULT_CHARACTER_NAME,
      race: prev.race || DEFAULT_CHARACTER_RACE,
      class: prev.class || DEFAULT_CHARACTER_CLASS,
      level: prev.level || DEFAULT_CHARACTER_LEVEL,
      abilities: prev.abilities || [defaultAbility],
      locationId: prev.locationId || DEFAULT_CHARACTER_LOCATION_ID,
      gold: prev.gold || DEFAULT_CHARACTER_GOLD,
      reputation: prev.reputation || DEFAULT_CHARACTER_REPUTATION,
      distance: prev.distance || DEFAULT_CHARACTER_DISTANCE,
      status: prev.status || DEFAULT_CHARACTER_STATUS,
      strength: prev.strength ?? Math.floor(Math.random() * (DEFAULT_STAT_MAX - DEFAULT_STAT_MIN + 1)) + DEFAULT_STAT_MIN,
      intelligence: prev.intelligence ?? Math.floor(Math.random() * (DEFAULT_STAT_MAX - DEFAULT_STAT_MIN + 1)) + DEFAULT_STAT_MIN,
      luck: prev.luck ?? Math.floor(Math.random() * (DEFAULT_STAT_MAX - DEFAULT_STAT_MIN + 1)) + DEFAULT_STAT_MIN
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
